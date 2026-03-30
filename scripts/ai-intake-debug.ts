import { config as loadEnv } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import OpenAI from "openai";

if (existsSync(resolve(process.cwd(), ".env.local"))) {
  loadEnv({ path: resolve(process.cwd(), ".env.local"), override: false });
}
if (existsSync(resolve(process.cwd(), ".env"))) {
  loadEnv({ path: resolve(process.cwd(), ".env"), override: false });
}

import { extractFacts } from "../src/lib/extraction/extract-facts";
import { buildIntakeExtractionPrompt } from "../src/lib/intake/prompt-templates";
import { buildIntakeAnalysis } from "../src/lib/listing-session/intake";
import { listingDraftSchema } from "../src/lib/validation/listing-session";
import { extractedFactsSchema, type ExtractedFacts } from "../src/lib/validation/extracted-facts";
import { DEBUG_CASES, type DebugCase } from "./ai-intake-cases";

type StageMode = "intake" | "full" | "both";

const intakeFactsJsonSchema = {
  name: "intake_known_facts",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "price",
      "areaTotal",
      "bedrooms",
      "bathrooms",
      "floor",
      "hasElevator",
      "city",
      "district",
      "propertyType",
      "dealType",
      "distanceToSeaMeters",
      "furnished",
    ],
    properties: {
      price: { type: ["number", "null"] },
      areaTotal: { type: ["number", "null"] },
      bedrooms: { type: ["number", "null"] },
      bathrooms: { type: ["number", "null"] },
      floor: { type: ["number", "null"] },
      hasElevator: { type: ["boolean", "null"] },
      city: { type: ["string", "null"] },
      district: { type: ["string", "null"] },
      propertyType: { type: ["string", "null"] },
      dealType: { type: ["string", "null"], enum: ["sale", "rent", null] },
      distanceToSeaMeters: { type: ["number", "null"] },
      furnished: { type: ["boolean", "null"] },
    },
  },
} as const;

const listingDraftJsonSchema = {
  name: "listing_draft",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["title", "description", "facts", "seo"],
    properties: {
      title: { type: "string" },
      description: { type: "string" },
      facts: {
        type: "object",
        additionalProperties: false,
        required: ["price", "area", "rooms"],
        properties: {
          price: { type: "number" },
          area: { type: "number" },
          rooms: { type: "number" },
        },
      },
      city: { type: "string" },
      district: { type: "string" },
      propertyType: { type: "string" },
      amenities: { type: "array", items: { type: "string" } },
      propertyOffers: { type: "array", items: { type: "string" } },
      seo: {
        type: "object",
        additionalProperties: false,
        required: ["metaTitle", "metaDescription"],
        properties: {
          metaTitle: { type: "string" },
          metaDescription: { type: "string" },
        },
      },
    },
  },
} as const;

function buildDraftPrompt(input: { sourceText: string; extractedFacts: ExtractedFacts }) {
  return [
    "Generate a full real-estate listing draft JSON.",
    "Use extractedFacts as highest-trust source.",
    "Do not invent uncertain hard facts.",
    "",
    `sourceText:\n${input.sourceText}`,
    "",
    `extractedFacts:\n${JSON.stringify(input.extractedFacts)}`,
  ].join("\n");
}

function getOpenAIClientFromEnv() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({
    apiKey,
    project: process.env.OPENAI_PROJECT || undefined,
    organization: process.env.OPENAI_ORGANIZATION || undefined,
  });
}

function parseArg(name: string) {
  const idx = process.argv.findIndex((a) => a === `--${name}`);
  if (idx === -1) return undefined;
  return process.argv[idx + 1];
}

function getCaseSelection(): DebugCase[] {
  const caseId = parseArg("case");
  if (!caseId || caseId === "all") return DEBUG_CASES;
  const selected = DEBUG_CASES.find((c) => c.id === caseId);
  if (!selected) {
    throw new Error(`Unknown case '${caseId}'. Available: ${DEBUG_CASES.map((c) => c.id).join(", ")}`);
  }
  return [selected];
}

function getStageMode(): StageMode {
  const stage = parseArg("stage") as StageMode | undefined;
  if (!stage) return "both";
  if (stage !== "intake" && stage !== "full" && stage !== "both") {
    throw new Error(`Invalid --stage '${stage}'. Use intake|full|both`);
  }
  return stage;
}

function fakeAssets(photoCount: number) {
  return Array.from({ length: photoCount }, (_, idx) => ({
    id: `photo-${idx + 1}`,
    sessionId: "debug",
    kind: "photo",
    storageKey: `memory/photo/${idx + 1}.jpg`,
    fileName: `${idx + 1}.jpg`,
    mimeType: "image/jpeg",
    size: 1000,
    sortOrder: idx,
    status: "uploaded",
    createdAt: new Date(),
  })) as any[];
}

function stripNulls<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== null)) as Partial<T>;
}

function printSection(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function runCase(testCase: DebugCase, stageMode: StageMode) {
  const client = getOpenAIClientFromEnv();
  const model = process.env.OPENAI_DRAFT_MODEL || "gpt-4o-mini";
  printSection(`CASE: ${testCase.id} (${testCase.title})`);
  let sourceText = "";
  let knownFacts: ExtractedFacts = {};
  let photoCount = 0;

  for (let i = 0; i < testCase.turns.length; i += 1) {
    const turn = testCase.turns[i];
    sourceText = sourceText ? `${sourceText}\n${turn.user}` : turn.user;
    photoCount = Math.max(photoCount, turn.photoCount ?? photoCount);

    printSection(`TURN ${i + 1} USER INPUT`);
    console.log(turn.user);

    const ruleFacts = await extractFacts({ sourceText, transcript: null });
    const preKnown = extractedFactsSchema.parse({ ...knownFacts, ...ruleFacts });
    const prompt = buildIntakeExtractionPrompt({
      sourceText,
      transcript: null,
      existingFacts: preKnown,
    });
    const intakeResponse = await client.responses.create({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }],
      text: { format: { type: "json_schema", ...intakeFactsJsonSchema } },
    });
    const rawIntake = intakeResponse.output_text?.trim() ?? "";
    const parsedIntake = extractedFactsSchema.parse(stripNulls(JSON.parse(rawIntake || "{}")));

    knownFacts = extractedFactsSchema.parse({ ...preKnown, ...parsedIntake });
    const intake = buildIntakeAnalysis({ facts: knownFacts, assets: fakeAssets(photoCount) as any });

    if (stageMode === "intake" || stageMode === "both") {
      printSection("PROMPT USED");
      console.log(prompt);

      printSection("RAW MODEL RESPONSE");
      console.log(rawIntake || "(empty)");

      printSection("PARSED RESULT");
      console.log(JSON.stringify(parsedIntake, null, 2));

      printSection("KNOWN FACTS");
      console.log(JSON.stringify(intake.knownFacts, null, 2));

      printSection("MISSING REQUIRED FACTS");
      console.log(intake.missingRequiredFacts.join(", ") || "(none)");

      printSection("MISSING OPTIONAL FACTS");
      console.log(intake.missingOptionalFacts.join(", ") || "(none)");

      printSection("NEXT ASSISTANT QUESTION");
      console.log(intake.questionsForUser[0] ?? "(no question)");
    }

    if ((stageMode === "full" || stageMode === "both") && intake.isReadyForDraft) {
      const draftPrompt = buildDraftPrompt({ sourceText, extractedFacts: intake.knownFacts });
      const draftResponse = await client.responses.create({
        model,
        input: [{ role: "user", content: [{ type: "input_text", text: draftPrompt }] }],
        text: { format: { type: "json_schema", ...listingDraftJsonSchema } },
      });
      const draftRaw = draftResponse.output_text?.trim() ?? "";
      const draft = listingDraftSchema.parse(JSON.parse(draftRaw || "{}"));
      printSection("FULL DRAFT (STAGE B)");
      console.log(
        JSON.stringify(
          {
            title: draft.title,
            city: draft.address?.city,
            propertyType: draft.facts?.propertyType,
            facts: draft.facts,
            seo: draft.seo,
          },
          null,
          2,
        ),
      );
    }
  }
}

async function main() {
  const cases = getCaseSelection();
  const stage = getStageMode();
  for (const c of cases) {
    await runCase(c, stage);
  }
}

main().catch((error) => {
  console.error("[ai-intake-debug] failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
