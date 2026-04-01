import type { ExtractedFacts } from "@/lib/validation/extracted-facts";
import type { ListingDraft } from "@/lib/validation/listing-session";

export type SupportedLanguage = "en" | "ru" | "uk" | "sq" | "it";

/**
 * Explicit language context that flows through the AI pipeline.
 *
 * - inputLanguage:    detected from user's raw text
 * - responseLanguage: always equals inputLanguage (AI responds in user's language)
 * - emphasizedLocale: the locale that must feel especially natural in generated content
 * - targetLocales:    all locales that must be generated (always all 5)
 */
export type LanguageContext = {
  inputLanguage: SupportedLanguage;
  responseLanguage: SupportedLanguage;
  emphasizedLocale: SupportedLanguage;
  targetLocales: readonly SupportedLanguage[];
};

export const ALL_LOCALES: readonly SupportedLanguage[] = ["en", "uk", "ru", "sq", "it"] as const;

export function buildLanguageContext(detected: SupportedLanguage): LanguageContext {
  return {
    inputLanguage: detected,
    responseLanguage: detected,
    emphasizedLocale: detected,
    targetLocales: ALL_LOCALES,
  };
}

export type DraftGeneratorInput = {
  sourceText: string;
  transcript?: string | null;
  extractedFacts: ExtractedFacts;
  /** Allowed taxonomy from Sanity — injected into the model prompt. */
  referenceContextText?: string;
  /** Explicit language context for deterministic locale routing. */
  languageContext?: LanguageContext;
  /** Optional audience/tone/style instruction extracted from the user message. */
  contentBrief?: string | null;
  /**
   * Operator-configured description style example (from operator settings).
   * Instructs the AI to mimic the example's tone, formatting, emoji usage,
   * and paragraph structure — but to use facts from the current listing only.
   * When absent the AI uses its default editorial style.
   */
  descriptionStyleExample?: string | null;
  /**
   * Visual context extracted from uploaded photos via vision analysis.
   * Formatted as a bullet list of per-image observations (EN).
   * The generator should incorporate relevant visual signals into ALL locale
   * descriptions natively — not translate from EN, but use as factual inputs.
   */
  visualContext?: string | null;
};

export interface DraftGenerator {
  generate(input: DraftGeneratorInput): Promise<ListingDraft>;
}
