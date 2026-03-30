import { z } from "zod";

export const sanityLocaleSchema = z.enum(["en", "uk", "ru", "sq", "it"]);
export type SanityLocale = z.infer<typeof sanityLocaleSchema>;
export const SANITY_LOCALES: SanityLocale[] = ["en", "uk", "ru", "sq", "it"];

export const localizedStringSchema = z
  .object({
    en: z.string().min(1).optional(),
    uk: z.string().min(1).optional(),
    ru: z.string().min(1).optional(),
    sq: z.string().min(1).optional(),
    it: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((s) => typeof s === "string" && s.trim().length > 0), {
    message: "At least one locale value is required",
  });

export type LocalizedString = z.infer<typeof localizedStringSchema>;

export const localizedTextSchema = z
  .object({
    en: z.string().min(1).optional(),
    uk: z.string().min(1).optional(),
    ru: z.string().min(1).optional(),
    sq: z.string().min(1).optional(),
    it: z.string().min(1).optional(),
  })
  .strict()
  .refine((v) => Object.values(v).some((s) => typeof s === "string" && s.trim().length > 0), {
    message: "At least one locale value is required",
  });

export type LocalizedText = z.infer<typeof localizedTextSchema>;

export function createEmptyLocalizedString(): Record<SanityLocale, string | undefined> {
  return {
    en: undefined,
    uk: undefined,
    ru: undefined,
    sq: undefined,
    it: undefined,
  };
}

export function createEmptyLocalizedText(): Record<SanityLocale, string | undefined> {
  return {
    en: undefined,
    uk: undefined,
    ru: undefined,
    sq: undefined,
    it: undefined,
  };
}

export function withEnglishFallback(
  value: Partial<Record<SanityLocale, string | undefined>> | undefined,
  locale: SanityLocale,
): string {
  if (!value) return "";
  const picked = value[locale];
  if (typeof picked === "string" && picked.trim()) return picked;
  const fallback = value.en;
  return typeof fallback === "string" ? fallback : "";
}

export function mergeLocalizedValue<T extends Partial<Record<SanityLocale, string | undefined>>>(
  base: T | undefined,
  patch: Partial<Record<SanityLocale, string | undefined>> | undefined,
): T {
  const next = { ...(base ?? {}) } as T;
  if (!patch) return next;
  for (const locale of SANITY_LOCALES) {
    const value = patch[locale];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length) {
        next[locale] = trimmed as T[typeof locale];
      }
    }
  }
  return next;
}

