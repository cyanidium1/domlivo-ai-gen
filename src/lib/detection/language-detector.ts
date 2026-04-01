/**
 * Simple deterministic language detection for the supported locales.
 * Used to route AI prompts and conversational responses.
 */
export type SupportedLanguage = "en" | "ru" | "uk" | "sq" | "it";

/**
 * Detect the dominant language of a text string.
 * Heuristics (in order of priority):
 *   1. High Cyrillic ratio + Ukrainian-specific chars → "uk"
 *   2. High Cyrillic ratio → "ru"
 *   3. Albanian diacritics or common Albanian words → "sq"
 *   4. Common Italian function words → "it"
 *   5. Default → "en"
 */
export function detectInputLanguage(text: string | null | undefined): SupportedLanguage {
  if (!text?.trim()) return "en";

  const chars = text.replace(/\s/g, "");
  if (!chars.length) return "en";

  const cyrillicCount = (text.match(/[\u0400-\u04FF]/g) ?? []).length;
  const cyrillicRatio = cyrillicCount / chars.length;

  if (cyrillicRatio > 0.08) {
    // Ukrainian-specific characters: і, ї, є, ґ (and uppercase)
    const ukCount = (text.match(/[іїєґІЇЄҐ]/g) ?? []).length;
    if (ukCount >= 2 || ukCount / cyrillicCount > 0.05) return "uk";
    return "ru";
  }

  // Albanian: characteristic diacritics or high-frequency Albanian words
  if (/[ëçÇÄ]/.test(text) || /\b(dhe|në|për|është|si|ka|me|nga|këtë|është)\b/i.test(text)) return "sq";

  // Italian: function words that rarely appear in EN
  if (/\b(per|con|una|nel|della|questo|questa|sono|anche|essere|come|tutto)\b/i.test(text)) return "it";

  return "en";
}

export function languageToLabel(lang: SupportedLanguage): string {
  switch (lang) {
    case "ru": return "Russian";
    case "uk": return "Ukrainian";
    case "sq": return "Albanian";
    case "it": return "Italian";
    default: return "English";
  }
}
