import "server-only";

import { getServerEnv } from "@/lib/config/server";
import { AppError } from "@/lib/errors/app-error";
import { getOpenAIClient } from "@/lib/openai/client";
import { mapOpenAIError } from "@/lib/openai/error";
import { extractedFactsSchema, normalizeExtractedFacts, type ExtractedFacts } from "@/lib/validation/extracted-facts";
import { buildIntakeExtractionPrompt } from "@/lib/intake/prompt-templates";

// OpenAI strict:true JSON schema rules:
//   1. additionalProperties must be false on every object.
//   2. Every key in properties must appear in required (nullable types handle "optional" semantics).
//   3. intakeHints (free-form record) is excluded — incompatible with strict mode.
//      The rule-based extractor in extract-facts.ts still populates it independently.
const intakeFactsJsonSchema = {
  name: "intake_known_facts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "price",
      "dealStatus",
      "area",
      "areaTotal",
      "bedrooms",
      "bathrooms",
      "yearBuilt",
      "country",
      "city",
      "displayAddress",
      "district",
      "streetLine",
      "postalCode",
      "propertyType",
      "sanityCityRef",
      "sanityDistrictRef",
      "sanityPropertyTypeRef",
    ],
    properties: {
      price: { type: ["number", "null"] },
      dealStatus: { type: ["string", "null"], enum: ["sale", "rent", "short-term", null] },
      area: { type: ["number", "null"] },
      areaTotal: { type: ["number", "null"] },
      bedrooms: { type: ["number", "null"] },
      bathrooms: { type: ["number", "null"] },
      yearBuilt: { type: ["number", "null"] },
      country: { type: ["string", "null"] },
      city: { type: ["string", "null"] },
      displayAddress: { type: ["string", "null"] },
      district: { type: ["string", "null"] },
      streetLine: { type: ["string", "null"] },
      postalCode: { type: ["string", "null"] },
      propertyType: { type: ["string", "null"] },
      sanityCityRef: { type: ["string", "null"] },
      sanityDistrictRef: { type: ["string", "null"] },
      sanityPropertyTypeRef: { type: ["string", "null"] },
    },
  },
} as const;

import type { SupportedLanguage } from "@/lib/detection/language-detector";

type AnalyzeIntakeInput = {
  sourceText?: string | null;
  transcript?: string | null;
  existingFacts: ExtractedFacts;
  photoCount: number;
  referenceContext?: string;
  detectedInputLanguage?: SupportedLanguage;
};

function summarizeFacts(facts: ExtractedFacts) {
  return Object.keys(facts).sort();
}

function stripNulls<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null)) as Partial<T>;
}

function parseJsonObjectWithFallback(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    if (first >= 0 && last > first) {
      return JSON.parse(raw.slice(first, last + 1)) as Record<string, unknown>;
    }
    throw new AppError("EXTERNAL_PROVIDER_FAILURE", "OpenAI intake returned non-JSON output", 502);
  }
}

export async function analyzeIntakeWithOpenAI(input: AnalyzeIntakeInput): Promise<ExtractedFacts> {
  const debug = await analyzeIntakeWithOpenAIDebug(input);
  return debug.facts;
}

export async function analyzeIntakeWithOpenAIDebug(input: AnalyzeIntakeInput): Promise<{
  facts: ExtractedFacts;
  prompt: string;
  rawResponse: string;
  requestId: string | null;
  model: string;
}> {
  try {
    const env = getServerEnv();
    const client = getOpenAIClient();
    const prompt = buildIntakeExtractionPrompt({
      sourceText: input.sourceText,
      transcript: input.transcript,
      existingFacts: input.existingFacts,
      referenceContext: input.referenceContext,
      detectedInputLanguage: input.detectedInputLanguage,
    });

    console.info(
      "[ai][intake] request",
      JSON.stringify({
        stage: "intake",
        model: env.OPENAI_DRAFT_MODEL,
        sourceLen: (input.sourceText ?? "").length,
        transcriptLen: (input.transcript ?? "").length,
        existingFacts: summarizeFacts(input.existingFacts),
        photoCount: input.photoCount,
      }),
    );

    const response = await client.responses.create({
      model: env.OPENAI_DRAFT_MODEL,
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          ...intakeFactsJsonSchema,
        },
      },
    });

    const outputText = response.output_text?.trim();
    if (!outputText) {
      throw new AppError("EXTERNAL_PROVIDER_FAILURE", "OpenAI intake returned empty output", 502);
    }

    const parsed = parseJsonObjectWithFallback(outputText);
    const facts = normalizeExtractedFacts(extractedFactsSchema.parse(stripNulls(parsed)));

    console.info(
      "[ai][intake] response",
      JSON.stringify({
        stage: "intake",
        model: env.OPENAI_DRAFT_MODEL,
        requestId: response.id ?? null,
        parsedFacts: summarizeFacts(facts),
      }),
    );

    return {
      facts,
      prompt,
      rawResponse: outputText,
      requestId: response.id ?? null,
      model: env.OPENAI_DRAFT_MODEL,
    };
  } catch (error) {
    console.error("[openai-intake-analyzer] failed");
    throw mapOpenAIError(error, "openai intake analysis");
  }
}
