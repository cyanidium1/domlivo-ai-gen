import type { ExtractedFacts } from "@/lib/validation/extracted-facts";
import type { SupportedLanguage } from "@/lib/detection/language-detector";

export type IntakePromptInput = {
  sourceText?: string | null;
  transcript?: string | null;
  existingFacts: ExtractedFacts;
  referenceContext?: string;
  detectedInputLanguage?: SupportedLanguage;
};

export function buildIntakeExtractionPrompt(input: IntakePromptInput) {
  const hasSource = Boolean(input.sourceText?.trim() || input.transcript?.trim());
  const langHint = input.detectedInputLanguage
    ? `The user input is primarily in ${input.detectedInputLanguage === "ru" ? "Russian" : input.detectedInputLanguage === "uk" ? "Ukrainian" : input.detectedInputLanguage === "sq" ? "Albanian" : input.detectedInputLanguage === "it" ? "Italian" : "English"}. Extract fields using multilingual patterns.`
    : "Support multilingual inputs (English, Russian, Ukrainian, Albanian, Italian).";

  return [
    "You are a real-estate intake assistant aligned with the Sanity property schema (see REFERENCE_DATA).",
    "Extract ONLY known, explicit facts from the user text below.",
    "Do not invent or guess values. If a value is ambiguous or absent, output null.",
    langHint,
    "",
    "FIELD RULES:",
    "- price: EUR amount only (number). Extract from phrases like '100k', '€200 000', '150000 EUR', '150 тысяч евро', '150к евро', '150 000 €'.",
    "- dealStatus: exactly one of sale | rent | short-term.",
    "  Map: 'продажа'/'продаю'/'продается'/'на продажу'→sale, 'аренда'/'rent'/'сдаю'/'сдаётся'/'оренда'→rent, 'посуточно'/'краткосрочно'/'short term'→short-term.",
    "- area: living area in m² (number). Extract from '100m2', '85 кв.м', '120 sqm', '100 квадратных метров', '100 м²', '85 кв. м.'.",
    "- city: city name matching REFERENCE_DATA when provided; otherwise the literal name from text.",
    "- propertyType: canonical English type name. Match REFERENCE_DATA when provided; otherwise use these synonyms:",
    "  RU/UK: квартира/квартиру/апартаменты→apartment, дом/будинок→house, вилла/вілла→villa,",
    "  студия/студія→studio, пентхаус→penthouse, таунхаус/дуплекс→townhouse.",
    "  IT: appartamento→apartment, casa→house, villa→villa.",
    "  SQ: apartament→apartment, shtëpi→house, vilë→villa.",
    "  ALWAYS output the English canonical name (e.g. 'apartment'), never the Russian/Ukrainian word.",
    "- bedrooms/bathrooms: integer counts. '2-bedroom' → bedrooms:2. '3 комнаты' → bedrooms:3 if context says residential.",
    "- yearBuilt: 4-digit year 1800-2100. Map phrases like 'built in 2018', 'year 2020', 'construction year 2015', 'house from 2012', '2018 года постройки'.",
    "- district: neighborhood/district name. Extract from 'in the Blloku area', 'near Bllok', 'в районе X', 'квартал X'.",
    "- streetLine: street address if given. Extract from 'ul. Myslym Shyri 5', 'ул. X', 'on X street', 'B-r X'.",
    "- postalCode: numeric or alphanumeric postal code. Extract from 'ZIP 1001', 'postal code 1001', 'индекс 1001', 'код 10001'.",
    "- displayAddress: the best human-readable address for the listing. Combine streetLine + district + city if all known. Example: 'Rruga Myslym Shyri 5, Blloku, Tirana'.",
    "- Address mapping is mandatory: if user gives a location/street/address phrase, put it into streetLine and displayAddress.",
    "- country: ALWAYS output 'Albania' regardless of user text. Ignore any other country mentions.",
    "- intakeHints: put non-schema extras here (elevator, furnished, sea distance, parking count, floor, renovation type, view type, etc.).",
    "  Also capture any audience/tone instructions here, e.g. 'for investors', 'family home', 'write premium', 'concise'. Key: 'contentBrief'.",
    "  NEVER put these as top-level canonical fields.",
    "- sanityCityRef / sanityPropertyTypeRef: Sanity document _id if you can match exactly from REFERENCE_DATA.",
    "",
    hasSource ? "" : "WARNING: No source text provided — return null for all fields.",
    "",
    input.referenceContext?.trim()
      ? ["--- REFERENCE_DATA (Sanity) ---", input.referenceContext.trim(), "--- END REFERENCE_DATA ---", ""]
      : [],
    `sourceText:\n${input.sourceText?.trim() ?? "(empty)"}`,
    "",
    `transcript:\n${input.transcript?.trim() ?? "(empty)"}`,
    "",
    `existingFacts (already known — do not override unless new text contradicts):\n${JSON.stringify(input.existingFacts)}`,
  ]
    .flat()
    .join("\n");
}
