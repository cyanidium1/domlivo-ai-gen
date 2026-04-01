import { NextRequest, NextResponse } from "next/server";
import { applyConversationalEdit } from "@/lib/listing-session/conversational-editor";
import { listingDraftSchema } from "@/lib/validation/listing-session";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors/app-error";
import { extractedFactsSchema } from "@/lib/validation/extracted-facts";
import { getDraftGenerator } from "@/lib/ai";
import { analyzePropertyImages, buildVisualContextForPrompt } from "@/lib/ai/image-analyzer";
import { detectInputLanguage } from "@/lib/detection/language-detector";
import { buildLanguageContext } from "@/lib/ai/types";
import { getOperatorSettings } from "@/lib/operator-settings";
import { createBaseDraftFromFacts } from "@/lib/listing-session/draft-mapper";
import { getTempStorage } from "@/lib/storage";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function prismaJson(value: unknown): any {
  return JSON.parse(JSON.stringify(value));
}

function isDraftEligibleForConversationalEdit(draft: unknown) {
  const parsed = listingDraftSchema.safeParse(draft);
  if (!parsed.success) return false;
  const value = parsed.data;
  const locales = ["en", "ru", "uk", "sq", "it"] as const;
  const hasTitle = locales.some((locale) => (value.title?.[locale] ?? "").trim().length > 0);
  const hasShort = locales.some((locale) => (value.shortDescription?.[locale] ?? "").trim().length > 0);
  const hasDescription = locales.some((locale) => (value.description?.[locale] ?? "").trim().length > 0);
  return hasTitle && (hasShort || hasDescription);
}

function localizedScore(draft: unknown) {
  const parsed = listingDraftSchema.safeParse(draft);
  if (!parsed.success) return -1;
  const value = parsed.data;
  const locales = ["en", "ru", "uk", "sq", "it"] as const;
  let score = 0;
  for (const locale of locales) {
    if ((value.title?.[locale] ?? "").trim()) score += 1;
    if ((value.shortDescription?.[locale] ?? "").trim()) score += 1;
    if ((value.description?.[locale] ?? "").trim()) score += 1;
  }
  return score;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json() as { instruction?: unknown; detectedInputLanguage?: unknown };

    if (!body.instruction || typeof body.instruction !== "string") {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "instruction is required" } }, { status: 400 });
    }

    const session = await prisma.listingSession.findUnique({
      where: { id },
      include: {
        assets: {
          where: { status: { not: "deleted" }, kind: "photo" },
          orderBy: { sortOrder: "asc" },
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: { code: "NOT_FOUND", message: "Session not found" } }, { status: 404 });
    }

    // Prefer editedDraft when valid, otherwise fallback to generatedDraft.
    const editedEligible = isDraftEligibleForConversationalEdit(session.editedDraft);
    const generatedEligible = isDraftEligibleForConversationalEdit(session.generatedDraft);
    const preferredDraft =
      editedEligible && generatedEligible
        ? localizedScore(session.generatedDraft) > localizedScore(session.editedDraft)
          ? session.generatedDraft
          : session.editedDraft
        : editedEligible
          ? session.editedDraft
          : generatedEligible
            ? session.generatedDraft
            : null;
    const currentDraftParsed = listingDraftSchema.safeParse(preferredDraft);
    if (!currentDraftParsed.success) {
      return NextResponse.json({ error: { code: "NO_DRAFT", message: "No valid draft to edit. Generate a draft first." } }, { status: 400 });
    }

    const extractedFactsParsed = extractedFactsSchema.safeParse(session.extractedFacts);
    const currentFacts = extractedFactsParsed.success ? extractedFactsParsed.data : {};

    const detectedLang =
      typeof body.detectedInputLanguage === "string"
        ? (body.detectedInputLanguage as "en" | "ru" | "uk" | "sq" | "it")
        : detectInputLanguage(body.instruction);

    const result = await applyConversationalEdit({
      instruction: body.instruction,
      currentDraft: currentDraftParsed.data,
      currentFacts,
      responseLanguage: detectedLang,
    });

    let finalDraft = result.updatedDraft;

    // If the edit requests a full content rewrite, regenerate the content via the
    // draft generator — passing both the operator style example and the contentBrief
    // (audience/tone instruction) so the output respects both operator style and the
    // user's specific request (e.g. "rewrite for investor", "make it shorter", etc.).
    if (result.needsContentRewrite) {
      try {
        const operatorSettings = await getOperatorSettings().catch(() => ({ descriptionExample: null }));

        // Re-run vision analysis on photos so image-derived signals (sea view, furnishings, etc.)
        // survive content rewrites — same as in generateListingDraft.
        let visualContext: string | null = null;
        if (session.assets.length > 0) {
          try {
            const storage = getTempStorage();
            const imageInputs = (
              await Promise.all(
                session.assets.slice(0, 4).map(async (asset) => {
                  const content = await storage.read(asset.storageKey);
                  return content ? { bytes: content.bytes, mimeType: content.mimeType } : null;
                }),
              )
            ).filter((x): x is NonNullable<typeof x> => x !== null);
            if (imageInputs.length > 0) {
              const imageAnalysis = await analyzePropertyImages(imageInputs);
              visualContext = buildVisualContextForPrompt(imageAnalysis);
            }
          } catch {
            // Non-fatal — continue without visual context
          }
        }

        const draftGenerator = getDraftGenerator();
        const combinedText = [session.sourceText, session.transcript].filter(Boolean).join(" ");
        const languageContext = buildLanguageContext(
          detectInputLanguage(combinedText || body.instruction),
        );
        const baseDraft = createBaseDraftFromFacts(id, currentFacts);
        const rewritten = await draftGenerator.generate({
          sourceText: session.sourceText ?? "",
          transcript: session.transcript ?? null,
          extractedFacts: currentFacts,
          languageContext,
          contentBrief: result.contentBrief || null,
          descriptionStyleExample: operatorSettings.descriptionExample,
          visualContext,
        });
        finalDraft = listingDraftSchema.parse({
          ...baseDraft,
          ...rewritten,
          // Preserve fact-patched values from the current draft (they may differ from stored facts)
          price: result.updatedDraft.price ?? rewritten.price,
          dealStatus: result.updatedDraft.dealStatus ?? rewritten.dealStatus,
          facts: result.updatedDraft.facts ?? rewritten.facts,
          address: result.updatedDraft.address ?? rewritten.address,
          ai: {
            ...(rewritten.ai ?? {}),
            rawExtractedFacts: currentFacts,
            generatedAt: new Date().toISOString(),
          },
        });
        console.info("[conversational-edit route] content rewritten via generator", {
          editType: result.editType,
          contentBrief: result.contentBrief?.slice(0, 80),
          styleExamplePresent: Boolean(operatorSettings.descriptionExample),
        });
      } catch (rewriteErr) {
        // Non-fatal: fall back to the fact-patched draft without content rewrite
        console.warn(
          "[conversational-edit route] content rewrite failed, using fact-patched draft",
          rewriteErr instanceof Error ? rewriteErr.message : String(rewriteErr),
        );
      }
    }

    // Persist the final draft
    await prisma.listingSession.update({
      where: { id },
      data: {
        editedDraft: prismaJson(finalDraft),
        status: "editing",
      },
    });

    return NextResponse.json({
      updatedDraft: finalDraft,
      changeSummary: result.changeSummary,
      needsContentRewrite: result.needsContentRewrite,
      editType: result.editType,
    });
  } catch (error) {
    console.error("[conversational-edit route] error", error);
    if (error instanceof AppError) {
      return NextResponse.json({ error: { code: error.code, message: error.message } }, { status: error.status });
    }
    return NextResponse.json({ error: { code: "INTERNAL_ERROR", message: "Conversational edit failed" } }, { status: 500 });
  }
}
