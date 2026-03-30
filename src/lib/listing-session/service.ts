import type { Prisma } from "@prisma/client";

import { getDraftGenerator } from "@/lib/ai";
import { analyzePropertyImages, buildImageEnrichmentText } from "@/lib/ai/image-analyzer";
import { prisma } from "@/lib/db/prisma";
import { extractFacts, recoverFactsFromText } from "@/lib/extraction/extract-facts";
import { AppError } from "@/lib/errors/app-error";
import { getListingPublisher } from "@/lib/publish";
import { analyzeIntakeWithOpenAI } from "@/lib/intake/openai-intake-analyzer";
import { buildIntakeAnalysis } from "@/lib/listing-session/intake";
import type { TempAssetKind } from "@/lib/storage/types";
import { getTempStorage } from "@/lib/storage";
import { getTranscriber } from "@/lib/transcription";
import { uploadPhoto, uploadTempAsset } from "@/lib/storage/upload-photo";
import { extractedFactsSchema, normalizeExtractedFacts } from "@/lib/validation/extracted-facts";
import {
  createSessionSchema,
  listingDraftSchema,
  updateSessionSchema,
} from "@/lib/validation/listing-session";
import { createBaseDraftFromFacts } from "@/lib/listing-session/draft-mapper";
import {
  CRITICAL_CONFIRMATION_FIELDS,
  getConfirmation,
  invalidateConfirmationOnDraftChange,
  setConfirmed,
  unsetConfirmed,
} from "@/lib/listing-session/confirmation";
import { buildPublishPayload } from "@/lib/listing-session/publish-payload";
import {
  alignDraftAddressFromExtractedFacts,
  applyReferenceResolutionToFacts,
  fetchSanityReferenceData,
  formatReferenceContextForPrompt,
  sanitizeEmbeddedPropertyOffers,
} from "@/lib/sanity/reference-data";

const sessionWithAssetsInclude = {
  assets: {
    where: { status: { not: "deleted" } },
    orderBy: { sortOrder: "asc" },
  },
} satisfies Prisma.ListingSessionInclude;

function prismaJson<T>(value: T): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function ensureSessionExists(id: string) {
  const session = await prisma.listingSession.findUnique({ where: { id } });
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }
  return session;
}

async function createSessionAsset(params: {
  sessionId: string;
  kind: TempAssetKind;
  file: File;
  storageKey: string;
}) {
  const { sessionId, kind, file, storageKey } = params;
  const lastAsset = await prisma.sessionAsset.findFirst({
    where: { sessionId },
    orderBy: { sortOrder: "desc" },
  });

  return prisma.sessionAsset.create({
    data: {
      sessionId,
      kind,
      storageKey,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      size: file.size,
      sortOrder: (lastAsset?.sortOrder ?? -1) + 1,
      status: "uploaded",
    },
  });
}

export async function createListingSession(input: unknown) {
  const parsed = createSessionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid create session payload", 400, parsed.error.flatten());
  }

  return prisma.listingSession.create({
    data: {
      agentId: parsed.data.agentId,
      status: "collecting",
      confirmation: prismaJson({}),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    },
  });
}

export async function getListingSessionOrThrow(id: string) {
  const session = await prisma.listingSession.findUnique({
    where: { id },
    include: sessionWithAssetsInclude,
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }
  return session;
}

export async function patchListingSession(id: string, input: unknown) {
  const existing = await prisma.listingSession.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  const parsed = updateSessionSchema.safeParse(input);
  if (!parsed.success) {
    throw new AppError("VALIDATION_ERROR", "Invalid patch payload", 400, parsed.error.flatten());
  }

  const existingDraftParsed = listingDraftSchema.safeParse(existing.editedDraft);
  const existingDraft = existingDraftParsed.success ? existingDraftParsed.data : null;
  const nextDraft = parsed.data.editedDraft ?? existingDraft;
  let nextConfirmation = getConfirmation(existing as { confirmation?: unknown });
  if (parsed.data.editedDraft !== undefined) {
    nextConfirmation = invalidateConfirmationOnDraftChange(existingDraft, nextDraft, nextConfirmation);
  }
  for (const path of parsed.data.confirmationSet ?? []) {
    if ((CRITICAL_CONFIRMATION_FIELDS as readonly string[]).includes(path)) {
      nextConfirmation = setConfirmed(nextConfirmation, path as (typeof CRITICAL_CONFIRMATION_FIELDS)[number]);
    }
  }
  for (const path of parsed.data.confirmationUnset ?? []) {
    if ((CRITICAL_CONFIRMATION_FIELDS as readonly string[]).includes(path)) {
      nextConfirmation = unsetConfirmed(nextConfirmation, path as (typeof CRITICAL_CONFIRMATION_FIELDS)[number]);
    }
  }

  return prisma.listingSession.update({
    where: { id },
    data: {
      ...(parsed.data.sourceText !== undefined ? { sourceText: parsed.data.sourceText } : {}),
      ...(parsed.data.editedDraft !== undefined
        ? { editedDraft: prismaJson(parsed.data.editedDraft), status: "editing" as const }
        : {}),
      confirmation: prismaJson(nextConfirmation),
    },
  });
}

export async function uploadListingPhoto(id: string, file: File) {
  await ensureSessionExists(id);

  const upload = await uploadPhoto(file);
  const asset = await createSessionAsset({
    sessionId: id,
    kind: "photo",
    file,
    storageKey: upload.storageKey,
  });

  return { ...asset, url: upload.url };
}

export async function removeListingPhoto(id: string, assetId: string) {
  await ensureSessionExists(id);
  const asset = await prisma.sessionAsset.findFirst({
    where: { id: assetId, sessionId: id, kind: "photo", status: { not: "deleted" } },
  });
  if (!asset) {
    throw new AppError("NOT_FOUND", "Photo not found", 404);
  }

  await prisma.sessionAsset.update({
    where: { id: asset.id },
    data: { status: "deleted" },
  });
  await getTempStorage().delete(asset.storageKey);
  return { id: asset.id, removed: true };
}

export async function uploadListingAudio(id: string, file: File) {
  await ensureSessionExists(id);

  // MVP rule: one active audio per session (replace previous).
  const previousAudioAssets = await prisma.sessionAsset.findMany({
    where: { sessionId: id, kind: "audio", status: { not: "deleted" } },
    select: { storageKey: true },
  });

  await prisma.sessionAsset.updateMany({
    where: { sessionId: id, kind: "audio", status: { not: "deleted" } },
    data: { status: "deleted" },
  });

  const storage = getTempStorage();
  await Promise.all(previousAudioAssets.map((asset) => storage.delete(asset.storageKey)));

  const upload = await uploadTempAsset({ file, kind: "audio" });
  const asset = await createSessionAsset({
    sessionId: id,
    kind: "audio",
    file,
    storageKey: upload.storageKey,
  });

  return { ...asset, url: upload.url };
}

export async function transcribeListingAudio(id: string, file: File) {
  await ensureSessionExists(id);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const transcriber = getTranscriber();
  const result = await transcriber.transcribe({
    bytes,
    fileName: file.name,
    mimeType: file.type || "audio/webm",
  });

  return {
    transcript: result.transcript,
    provider: result.provider,
  };
}

/** Extracts human-readable EN name from a localized Sanity title field. */
function sanityTitleEn(title: Record<string, string | undefined> | null | undefined): string {
  if (!title || typeof title !== "object") return "";
  return (title.en ?? "").trim();
}

export async function analyzeListingIntake(id: string) {
  const session = await prisma.listingSession.findUnique({
    where: { id },
    include: sessionWithAssetsInclude,
  });
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  const sanityRef = await fetchSanityReferenceData();

  let transcript = session.transcript ?? null;
  const audioAsset = session.assets
    .filter((a) => a.kind === "audio" && a.status !== "deleted")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .at(-1);

  if ((!transcript || !transcript.trim()) && audioAsset) {
    const transcriber = getTranscriber();
    const content = await getTempStorage().read(audioAsset.storageKey);
    if (!content) {
      throw new AppError("TRANSCRIPTION_INPUT_MISSING", "Audio bytes not found in temp storage", 500);
    }
    const result = await transcriber.transcribe({
      bytes: content.bytes,
      fileName: audioAsset.fileName,
      mimeType: audioAsset.mimeType,
    });
    transcript = result.transcript;
  }

  const facts = await extractFacts({
    sourceText: session.sourceText,
    transcript,
  });
  const existingFactsParsed = extractedFactsSchema.safeParse(session.extractedFacts);
  const existingFacts = existingFactsParsed.success ? existingFactsParsed.data : {};
  const mergedRuleFacts = {
    ...existingFacts,
    ...facts,
  };
  const normalizedRuleFacts = normalizeExtractedFacts(extractedFactsSchema.parse(mergedRuleFacts));

  console.info(
    "[ai][intake] pre-openai",
    JSON.stringify({
      stage: "intake",
      sessionId: id,
      knownRuleFacts: Object.keys(normalizedRuleFacts).sort(),
      existingFacts: Object.keys(existingFacts).sort(),
      ruleExtractedFacts: Object.keys(facts).sort(),
      sourceLen: (session.sourceText ?? "").length,
      transcriptLen: (transcript ?? "").length,
      photoCount: session.assets.filter((a) => a.kind === "photo" && a.status !== "deleted").length,
    }),
  );

  const openAiFacts = await analyzeIntakeWithOpenAI({
    sourceText: session.sourceText,
    transcript,
    existingFacts: normalizedRuleFacts,
    photoCount: session.assets.filter((a) => a.kind === "photo" && a.status !== "deleted").length,
    referenceContext: formatReferenceContextForPrompt(sanityRef),
  });

  const normalizedFacts = normalizeExtractedFacts(
    extractedFactsSchema.parse({
      ...normalizedRuleFacts,
      ...openAiFacts,
    }),
  );
  const recoveredFacts = recoverFactsFromText(
    {
      sourceText: session.sourceText,
      transcript,
    },
    normalizedFacts,
  );
  const resolution = applyReferenceResolutionToFacts(recoveredFacts, sanityRef);
  const finalFacts = resolution.facts;

  // Build context-aware questions using Sanity reference names.
  const cityNames = sanityRef.enabled
    ? sanityRef.cities.map((c) => sanityTitleEn(c.title)).filter(Boolean)
    : [];
  const propertyTypeNames = sanityRef.enabled
    ? sanityRef.propertyTypes.map((p) => sanityTitleEn(p.title)).filter(Boolean)
    : [];

  const intake = buildIntakeAnalysis({
    facts: finalFacts,
    assets: session.assets,
    referenceBlocksIntake: resolution.blocksIntake,
    referenceMessages: resolution.messages,
    cityNames,
    propertyTypeNames,
  });

  console.info(
    "[ai][intake] merge-details",
    JSON.stringify({
      stage: "intake",
      sessionId: id,
      mergeStrategy: "existing + rule + openai (openai wins when key provided)",
      existingFacts,
      ruleFacts: normalizedRuleFacts,
      openAiFacts,
      mergedFacts: finalFacts,
    }),
  );

  console.info(
    "[ai][intake] post-merge",
    JSON.stringify({
      stage: "intake",
      sessionId: id,
      knownFacts: Object.keys(finalFacts).sort(),
      missingRequired: intake.missingRequiredFacts,
      missingOptional: intake.missingOptionalFacts,
      ready: intake.isReadyForDraft,
      knownFactsPayload: intake.knownFacts,
      referenceMessages: intake.referenceMessages,
    }),
  );

  // Build a partial draft from known facts so the preview panel stays useful
  // before full generation. Only set if no editedDraft exists yet.
  const hasExistingDraft = session.editedDraft != null;
  const partialDraft = hasExistingDraft ? undefined : prismaJson(createBaseDraftFromFacts(id, finalFacts));

  const updated = await prisma.listingSession.update({
    where: { id },
    data: {
      transcript,
      extractedFacts: prismaJson(finalFacts),
      status: intake.isReadyForDraft ? "ready" : "collecting",
      ...(partialDraft ? { editedDraft: partialDraft } : {}),
    },
    include: sessionWithAssetsInclude,
  });

  return { session: updated, intake };
}

export async function generateListingDraft(id: string) {
  const stageA = await analyzeListingIntake(id);
  if (!stageA.intake.isReadyForDraft && !stageA.intake.isReadyForTextDraft) {
    throw new AppError("MISSING_REQUIRED_FACTS", "Complete required facts before full draft generation", 400, {
      missingRequiredFacts: stageA.intake.missingRequiredFacts,
      questionsForUser: stageA.intake.questionsForUser,
    });
  }

  const session = stageA.session;
  await prisma.listingSession.update({ where: { id }, data: { status: "processing" } });

  try {
    console.info(
      "[ai][draft] request",
      JSON.stringify({
        stage: "draft",
        sessionId: id,
        knownFacts: Object.keys(stageA.intake.knownFacts).sort(),
        missingRequired: stageA.intake.missingRequiredFacts,
      }),
    );

    const transcript = session.transcript;
    const extractedFacts = stageA.intake.knownFacts;
    const sanityRef = await fetchSanityReferenceData();

    const draftGenerator = getDraftGenerator();
    const baseDraft = createBaseDraftFromFacts(id, extractedFacts);
    const generated = await draftGenerator.generate({
      sourceText: session.sourceText ?? "",
      transcript,
      extractedFacts,
      referenceContextText: formatReferenceContextForPrompt(sanityRef),
    });
    let draft = listingDraftSchema.parse({
      ...baseDraft,
      ...generated,
      ai: {
        ...(generated.ai ?? baseDraft.ai),
        sourcePrompt: session.sourceText ?? undefined,
        transcript: transcript ?? undefined,
        rawExtractedFacts: extractedFacts,
        generatedAt: new Date().toISOString(),
      },
    });
    draft = sanitizeEmbeddedPropertyOffers(draft);
    draft = alignDraftAddressFromExtractedFacts(draft, extractedFacts);

    // Enrich description with image analysis (best-effort, non-blocking).
    const photoAssets = session.assets.filter((a) => a.kind === "photo" && a.status !== "deleted");
    if (photoAssets.length > 0) {
      try {
        const storage = getTempStorage();
        const imageInputs = (
          await Promise.all(
            photoAssets.slice(0, 4).map(async (asset) => {
              const content = await storage.read(asset.storageKey);
              return content ? { bytes: content.bytes, mimeType: content.mimeType } : null;
            }),
          )
        ).filter((x): x is NonNullable<typeof x> => x !== null);

        if (imageInputs.length > 0) {
          const imageAnalysis = await analyzePropertyImages(imageInputs);
          const enrichment = buildImageEnrichmentText(imageAnalysis);
          if (enrichment) {
            // Append image-derived context to each locale's description.
            const locales = ["en", "uk", "ru", "sq", "it"] as const;
            const description = { ...(draft.description ?? {}) };
            for (const locale of locales) {
              const existing = (description as Record<string, string | undefined>)[locale] ?? "";
              if (existing) {
                (description as Record<string, string>)[locale] = `${existing}\n\n${enrichment}`;
              } else {
                (description as Record<string, string>)[locale] = enrichment;
              }
            }
            draft = { ...draft, description };
            console.info("[ai][draft] enriched description with", imageInputs.length, "image(s)");
          }
        }
      } catch (imgErr) {
        console.warn("[ai][draft] image analysis failed, continuing:", imgErr instanceof Error ? imgErr.message : String(imgErr));
      }
    }

    return prisma.listingSession.update({
      where: { id },
      data: {
        transcript,
        extractedFacts: prismaJson(extractedFacts),
        generatedDraft: prismaJson(draft),
        editedDraft: prismaJson(draft),
        status: "ready",
      },
    });
  } catch (error) {
    // Fallback: do not block operators if OpenAI fails.
    // Stage A guarantees required facts exist, so we can build a schema-valid draft.
    const fallbackDraft = createBaseDraftFromFacts(id, stageA.intake.knownFacts);

    console.error("[ai][draft] provider failed, using fallback draft", error);
    return prisma.listingSession.update({
      where: { id },
      data: {
        generatedDraft: prismaJson(fallbackDraft),
        editedDraft: prismaJson(fallbackDraft),
        status: "ready",
      },
      include: sessionWithAssetsInclude,
    });
  }
}

async function publishListingSessionInternal(id: string, mode: "draft" | "property") {
  const session = await prisma.listingSession.findUnique({ where: { id }, include: sessionWithAssetsInclude });
  if (!session) {
    throw new AppError("NOT_FOUND", "Session not found", 404);
  }

  const gate = buildPublishPayload({
    id: session.id,
    editedDraft: session.editedDraft,
    confirmation: (session as { confirmation?: unknown }).confirmation,
  });
  if (!gate.ok) {
    throw new AppError("VALIDATION_ERROR", "Publish gate failed", 400, gate.errors);
  }

  await prisma.listingSession.update({
    where: { id },
    data: { status: "publishing" },
  });

  try {
    console.info(
      "[publish][service] submit",
      JSON.stringify({
        sessionId: id,
        mode,
        existingSanityDocumentId: session.sanityDocumentId ?? null,
        payloadInternalRef: gate.payload.internalRef,
        galleryItems: gate.payload.gallery.length,
      }),
    );
    const publisher = getListingPublisher();
    const published = await publisher.publish({
      sessionId: id,
      payload: gate.payload,
      mode,
      existingSanityDocumentId: session.sanityDocumentId,
    });
    return prisma.listingSession.update({
      where: { id },
      data: {
        sanityDocumentId: published.sanityDocumentId,
        status: mode === "property" ? "published" : "editing",
      },
    });
  } catch (error) {
    await prisma.listingSession.update({ where: { id }, data: { status: "failed" } });
    if (error instanceof AppError) {
      throw error;
    }
    throw new AppError("PUBLISH_FAILED", "Failed to publish listing", 500);
  }
}

export async function publishListingSession(id: string) {
  return publishListingSessionInternal(id, "property");
}

export async function publishListingSessionDraft(id: string) {
  return publishListingSessionInternal(id, "draft");
}
