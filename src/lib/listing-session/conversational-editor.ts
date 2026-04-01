import "server-only";

import type { ListingDraft } from "@/lib/validation/listing-session";
import { listingDraftSchema } from "@/lib/validation/listing-session";
import { getOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/config/server";
import { AppError } from "@/lib/errors/app-error";
import { mapOpenAIError } from "@/lib/openai/error";
import type { SupportedLanguage } from "@/lib/detection/language-detector";
import type { ExtractedFacts } from "@/lib/validation/extracted-facts";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type FactPatches = {
  price: number | null;
  area: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  yearBuilt: number | null;
  city: string | null;
  district: string | null;
  postalCode: string | null;
  streetLine: string | null;
  displayAddress: string | null;
  propertyType: string | null;
  dealStatus: "sale" | "rent" | "short-term" | null;
};

export type EditType = "facts" | "content" | "both" | "noop";

export type EditInterpretation = {
  changeSummary: string;
  editType: EditType;
  factPatches: FactPatches;
  needsContentRewrite: boolean;
  contentBrief: string;
};

export type ConversationalEditInput = {
  instruction: string;
  currentDraft: ListingDraft;
  currentFacts: ExtractedFacts;
  responseLanguage?: SupportedLanguage;
};

export type ConversationalEditResult = {
  /** Draft with fact patches applied (content unchanged unless needsContentRewrite). */
  updatedDraft: ListingDraft;
  changeSummary: string;
  /** If true, caller should re-run draft generation with contentBrief. */
  needsContentRewrite: boolean;
  contentBrief: string;
  editType: EditType;
};

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI strict schema — AI returns patch operations, NOT full draft
// ─────────────────────────────────────────────────────────────────────────────

const editInterpretationJsonSchema = {
  name: "edit_interpretation",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "changeSummary",
      "editType",
      "factPatches",
      "needsContentRewrite",
      "contentBrief",
    ],
    properties: {
      changeSummary: { type: "string" },
      editType: {
        type: "string",
        enum: ["facts", "content", "both", "noop"],
      },
      needsContentRewrite: { type: "boolean" },
      contentBrief: { type: "string" },
      factPatches: {
        type: "object",
        additionalProperties: false,
        required: [
          "price",
          "area",
          "bedrooms",
          "bathrooms",
          "yearBuilt",
          "city",
          "district",
          "postalCode",
          "streetLine",
          "displayAddress",
          "propertyType",
          "dealStatus",
        ],
        properties: {
          price: { type: ["number", "null"] },
          area: { type: ["number", "null"] },
          bedrooms: { type: ["number", "null"] },
          bathrooms: { type: ["number", "null"] },
          yearBuilt: { type: ["number", "null"] },
          city: { type: ["string", "null"] },
          district: { type: ["string", "null"] },
          postalCode: { type: ["string", "null"] },
          streetLine: { type: ["string", "null"] },
          displayAddress: { type: ["string", "null"] },
          propertyType: { type: ["string", "null"] },
          dealStatus: {
            type: ["string", "null"],
            enum: ["sale", "rent", "short-term", null],
          },
        },
      },
    },
  },
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Prompt builder — sends facts summary, NOT full draft JSON
// ─────────────────────────────────────────────────────────────────────────────

function buildEditPrompt(input: ConversationalEditInput): string {
  const lang = input.responseLanguage ?? "en";
  const respondInLang =
    lang === "ru"
      ? "Respond in Russian"
      : lang === "uk"
        ? "Respond in Ukrainian"
        : lang === "sq"
          ? "Respond in Albanian"
          : lang === "it"
            ? "Respond in Italian"
            : "Respond in English";

  const { currentDraft, currentFacts } = input;

  const factsSummary = JSON.stringify({
    price: currentFacts.price ?? currentDraft.price,
    area: currentFacts.area ?? currentDraft.facts?.area,
    bedrooms: currentFacts.bedrooms ?? currentDraft.facts?.bedrooms,
    bathrooms: currentFacts.bathrooms ?? currentDraft.facts?.bathrooms,
    yearBuilt: currentFacts.yearBuilt ?? currentDraft.facts?.yearBuilt,
    city: currentFacts.city ?? currentDraft.address?.city,
    district: currentFacts.district ?? currentDraft.address?.district,
    postalCode: currentFacts.postalCode ?? currentDraft.address?.postalCode,
    streetLine: currentFacts.streetLine ?? currentDraft.address?.streetLine,
    displayAddress: currentFacts.displayAddress ?? currentDraft.address?.displayAddress?.en,
    propertyType: currentFacts.propertyType ?? currentDraft.facts?.propertyType,
    dealStatus: currentFacts.dealStatus ?? currentDraft.dealStatus,
  });

  return [
    "You are a real-estate listing editor. Interpret the edit instruction below.",
    `${respondInLang} in the changeSummary field.`,
    "",
    "INSTRUCTION:",
    input.instruction,
    "",
    "CURRENT FACTS (JSON):",
    factsSummary,
    "",
    "CURRENT CONTENT TITLES (EN only):",
    `title: ${currentDraft.title?.en ?? "(none)"}`,
    `shortDescription: ${currentDraft.shortDescription?.en ?? "(none)"}`,
    `description (first 200 chars): ${(currentDraft.description?.en ?? "(none)").slice(0, 200)}`,
    "",
    "TASK: Return a structured edit interpretation:",
    "",
    "editType rules:",
    '- "facts": instruction changes a numeric/enum field (price, area, bedrooms, city, district, dealStatus, etc.)',
    '- "content": instruction changes tone, style, audience, or rewrites title/description',
    '- "both": changes both facts and content',
    '- "noop": instruction is unclear or nothing to change',
    "",
    "factPatches rules:",
    "- For each field: return the NEW value if it should change, OR null if it should stay unchanged.",
    "- Null means DO NOT TOUCH the existing value. It does NOT mean remove.",
    "- propertyType must be English canonical (apartment, house, villa, studio, penthouse, townhouse, duplex).",
    "- dealStatus must be: sale, rent, or short-term.",
    "",
    "needsContentRewrite rules:",
    "- true: if instruction asks to rewrite title, description, shortDescription, or change audience/tone/style.",
    "- false: if only facts/fields are changed.",
    "",
    "contentBrief rules:",
    "- If needsContentRewrite=true: describe the target tone/audience/style in one sentence.",
    '- If needsContentRewrite=false: return empty string "".',
    "",
    "changeSummary: 1-2 sentences describing exactly what was changed.",
  ].join("\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Patch application — apply factPatches directly to draft without AI
// ─────────────────────────────────────────────────────────────────────────────

function applyFactPatchesToDraft(draft: ListingDraft, patches: FactPatches): ListingDraft {
  let updated = { ...draft };

  // Price
  if (patches.price !== null) {
    updated = { ...updated, price: patches.price };
  }

  // Facts
  const factsChanged =
    patches.area !== null ||
    patches.bedrooms !== null ||
    patches.bathrooms !== null ||
    patches.yearBuilt !== null ||
    patches.propertyType !== null;

  if (factsChanged) {
    const existingFacts = updated.facts ?? {};
    updated = {
      ...updated,
      facts: {
        ...existingFacts,
        ...(patches.area !== null && patches.area !== undefined ? { area: patches.area } : {}),
        ...(patches.bedrooms !== null && patches.bedrooms !== undefined ? { bedrooms: patches.bedrooms } : {}),
        ...(patches.bathrooms !== null && patches.bathrooms !== undefined ? { bathrooms: patches.bathrooms } : {}),
        ...(patches.yearBuilt !== null && patches.yearBuilt !== undefined ? { yearBuilt: patches.yearBuilt } : {}),
        ...(patches.propertyType !== null && patches.propertyType !== undefined
          ? { propertyType: patches.propertyType }
          : {}),
      },
    };
  }

  // DealStatus
  if (patches.dealStatus !== null && patches.dealStatus !== undefined) {
    updated = { ...updated, dealStatus: patches.dealStatus };
  }

  // Address
  const addressChanged =
    patches.city !== null ||
    patches.district !== null ||
    patches.postalCode !== null ||
    patches.streetLine !== null ||
    patches.displayAddress !== null;

  if (addressChanged) {
    const existingAddress = updated.address ?? {
      countryCode: "AL",
      displayAddress: { en: "", uk: "", ru: "", sq: "", it: "" },
      hideExactLocation: true,
    };
    const existingDisplay = existingAddress.displayAddress ?? { en: "", uk: "", ru: "", sq: "", it: "" };

    updated = {
      ...updated,
      address: {
        ...existingAddress,
        ...(patches.city !== null && patches.city !== undefined ? { city: patches.city } : {}),
        ...(patches.district !== null && patches.district !== undefined ? { district: patches.district } : {}),
        ...(patches.postalCode !== null && patches.postalCode !== undefined ? { postalCode: patches.postalCode } : {}),
        ...(patches.streetLine !== null && patches.streetLine !== undefined ? { streetLine: patches.streetLine } : {}),
        ...(patches.displayAddress !== null && patches.displayAddress !== undefined
          ? {
              displayAddress: {
                ...existingDisplay,
                en: patches.displayAddress,
                // Mirror to other locales if they were empty
                ...(existingDisplay.ru ? {} : { ru: patches.displayAddress }),
                ...(existingDisplay.uk ? {} : { uk: patches.displayAddress }),
                ...(existingDisplay.sq ? {} : { sq: patches.displayAddress }),
                ...(existingDisplay.it ? {} : { it: patches.displayAddress }),
              },
            }
          : {}),
      },
    };
  }

  // Validate via Zod (non-throwing)
  const parsed = listingDraftSchema.safeParse(updated);
  return parsed.success ? parsed.data : draft; // fallback to original if patches broke schema
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export async function applyConversationalEdit(
  input: ConversationalEditInput,
): Promise<ConversationalEditResult> {
  const env = getServerEnv();

  if (env.DRAFT_PROVIDER !== "openai") {
    return {
      updatedDraft: input.currentDraft,
      changeSummary:
        input.responseLanguage === "ru"
          ? "Изменение применено (тестовый режим — AI не активен)."
          : "Edit applied (stub mode — no AI available).",
      needsContentRewrite: false,
      contentBrief: "",
      editType: "noop",
    };
  }

  try {
    const client = getOpenAIClient();
    const prompt = buildEditPrompt(input);

    console.info(
      "[ai][edit] request",
      JSON.stringify({
        instructionLen: input.instruction.length,
        responseLanguage: input.responseLanguage ?? "en",
        factsKeys: Object.keys(input.currentFacts).sort(),
      }),
    );

    const response = await client.responses.create({
      model: env.OPENAI_DRAFT_MODEL,
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: prompt }],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...editInterpretationJsonSchema,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new AppError("EXTERNAL_PROVIDER_FAILURE", "OpenAI edit returned empty output", 502);
    }

    const parsed = JSON.parse(outputText) as EditInterpretation;

    console.info(
      "[ai][edit] interpretation",
      JSON.stringify({
        editType: parsed.editType,
        needsContentRewrite: parsed.needsContentRewrite,
        contentBrief: parsed.contentBrief,
        changeSummary: parsed.changeSummary?.slice(0, 100),
        patchedFields: Object.entries(parsed.factPatches ?? {})
          .filter(([, v]) => v !== null)
          .map(([k]) => k),
      }),
    );

    // Apply fact patches directly (no AI needed)
    const updatedDraft =
      parsed.editType === "facts" || parsed.editType === "both"
        ? applyFactPatchesToDraft(input.currentDraft, parsed.factPatches)
        : input.currentDraft;

    return {
      updatedDraft,
      changeSummary: parsed.changeSummary || "Applied your changes.",
      needsContentRewrite: Boolean(parsed.needsContentRewrite),
      contentBrief: parsed.contentBrief || "",
      editType: parsed.editType,
    };
  } catch (error) {
    console.error(
      "[conversational-editor] failed",
      error instanceof Error ? error.message : String(error),
    );
    throw mapOpenAIError(error, "conversational edit");
  }
}
