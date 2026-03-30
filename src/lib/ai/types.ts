import type { ExtractedFacts } from "@/lib/validation/extracted-facts";
import type { ListingDraft } from "@/lib/validation/listing-session";

export type DraftGeneratorInput = {
  sourceText: string;
  transcript?: string | null;
  extractedFacts: ExtractedFacts;
  /** Allowed taxonomy from Sanity — injected into the model prompt. */
  referenceContextText?: string;
};

export interface DraftGenerator {
  generate(input: DraftGeneratorInput): Promise<ListingDraft>;
}

