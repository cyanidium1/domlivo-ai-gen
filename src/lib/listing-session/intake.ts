import type { SessionAsset } from "@prisma/client";

import {
  INTAKE_OPTIONAL_FACT_KEYS,
  INTAKE_REQUIRED_FACT_KEYS,
  type IntakeOptionalFactKey,
  type IntakeRequiredFactKey,
} from "@/lib/listing-session/field-requirements";
import type { ExtractedFacts } from "@/lib/validation/extracted-facts";

/** @deprecated use INTAKE_REQUIRED_FACT_KEYS */
export const REQUIRED_FACT_KEYS = INTAKE_REQUIRED_FACT_KEYS;
/** @deprecated use INTAKE_OPTIONAL_FACT_KEYS */
export const OPTIONAL_FACT_KEYS = INTAKE_OPTIONAL_FACT_KEYS;

export type RequiredFactKey = IntakeRequiredFactKey;
export type OptionalFactKey = IntakeOptionalFactKey;

function factArea(f: ExtractedFacts): number | undefined {
  return f.area ?? f.areaTotal;
}

/** Order used for deterministic next-question prompts (subset of keys). */
export const REQUIRED_FACT_ORDER: readonly RequiredFactKey[] = [
  "price",
  "dealStatus",
  "propertyType",
  "area",
  "city",
  "photo",
];

export type IntakeAnalysis = {
  knownFacts: ExtractedFacts;
  missingRequiredFacts: RequiredFactKey[];
  missingOptionalFacts: OptionalFactKey[];
  /**
   * English-language question strings — kept for backward compatibility and logging.
   * The UI uses missingRequiredFacts + cityNames/propertyTypeNames to build
   * localized questions; do not use questionsForUser for display.
   */
  questionsForUser: string[];
  isReadyForDraft: boolean;
  /** True when all text-based required facts are present (no photo needed). Enables early AI draft. */
  isReadyForTextDraft: boolean;
  referenceMessages: string[];
  /** Available city names from Sanity — used by the client to build localized city question hints. */
  cityNames: string[];
  /** Available property type names from Sanity — used by the client to build localized type question hints. */
  propertyTypeNames: string[];
};

function hasNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function hasNonNegInt(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasPhoto(assets: SessionAsset[]) {
  return assets.some((a) => a.kind === "photo" && a.status !== "deleted");
}

type QuestionOpts = {
  cityNames?: string[];
  propertyTypeNames?: string[];
};

function questionForRequired(key: RequiredFactKey, opts?: QuestionOpts): string {
  switch (key) {
    case "price":
      return "What is the listing price in EUR?";
    case "city": {
      const hint =
        opts?.cityNames?.length
          ? ` Allowed values: ${opts.cityNames.slice(0, 10).join(", ")}.`
          : "";
      return `Which city is this property in?${hint}`;
    }
    case "propertyType": {
      const hint =
        opts?.propertyTypeNames?.length
          ? ` Allowed values: ${opts.propertyTypeNames.slice(0, 10).join(", ")}.`
          : "";
      return `What is the property type?${hint}`;
    }
    case "dealStatus":
      return "Is this sale, rent, or short-term?";
    case "area":
      return "What is the living area in square meters (m²)?";
    case "photo":
      return "Please upload at least one property photo.";
  }
}

export type BuildIntakeAnalysisParams = {
  facts: ExtractedFacts;
  assets: SessionAsset[];
  referenceBlocksIntake?: boolean;
  referenceMessages?: string[];
  /** Allowed city names from Sanity — shown in the city question. */
  cityNames?: string[];
  /** Allowed property type names from Sanity — shown in the propertyType question. */
  propertyTypeNames?: string[];
};

export function buildIntakeAnalysis(params: BuildIntakeAnalysisParams): IntakeAnalysis {
  const { facts, assets } = params;
  const referenceBlocksIntake = Boolean(params.referenceBlocksIntake);
  const referenceMessages = params.referenceMessages ?? [];
  const cityNames = params.cityNames ?? [];
  const propertyTypeNames = params.propertyTypeNames ?? [];
  const questionOpts: QuestionOpts = { cityNames, propertyTypeNames };

  const missingRequiredFacts: RequiredFactKey[] = [];
  if (!hasNumber(facts.price)) missingRequiredFacts.push("price");
  if (!facts.dealStatus) missingRequiredFacts.push("dealStatus");
  if (!hasText(facts.city)) missingRequiredFacts.push("city");
  if (!hasText(facts.propertyType)) missingRequiredFacts.push("propertyType");
  if (!hasNumber(factArea(facts))) missingRequiredFacts.push("area");
  if (!hasPhoto(assets)) missingRequiredFacts.push("photo");

  const missingOptionalFacts: OptionalFactKey[] = [];
  if (!hasNonNegInt(facts.bedrooms)) missingOptionalFacts.push("bedrooms");
  if (!hasNonNegInt(facts.bathrooms)) missingOptionalFacts.push("bathrooms");
  if (!hasNumber(facts.yearBuilt)) missingOptionalFacts.push("yearBuilt");
  if (!hasText(facts.district)) missingOptionalFacts.push("district");
  if (!hasText(facts.displayAddress)) missingOptionalFacts.push("displayAddress");
  if (!hasText(facts.streetLine)) missingOptionalFacts.push("streetLine");
  if (!hasText(facts.postalCode)) missingOptionalFacts.push("postalCode");

  const sortedRequired = REQUIRED_FACT_ORDER.filter((key) => missingRequiredFacts.includes(key));
  const coreQuestions = sortedRequired.map((key) => questionForRequired(key, questionOpts));
  const questionsForUser = [...referenceMessages, ...coreQuestions];

  const isReadyForDraft = missingRequiredFacts.length === 0 && !referenceBlocksIntake;

  const missingTextFacts = missingRequiredFacts.filter((k) => k !== "photo");
  const isReadyForTextDraft = missingTextFacts.length === 0 && !referenceBlocksIntake;

  return {
    knownFacts: facts,
    missingRequiredFacts,
    missingOptionalFacts,
    questionsForUser,
    isReadyForDraft,
    isReadyForTextDraft,
    referenceMessages,
    cityNames,
    propertyTypeNames,
  };
}
