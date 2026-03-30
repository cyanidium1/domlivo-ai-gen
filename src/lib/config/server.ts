import "server-only";

import { z } from "zod";

import { AppError } from "@/lib/errors/app-error";

const optionalNonEmpty = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().min(1).optional(),
);

const envSchema = z
  .object({
    TEMP_STORAGE_PROVIDER: z.enum(["memory", "local", "r2", "supabase"]).default("memory"),
    TRANSCRIPTION_PROVIDER: z.enum(["stub", "openai"]).default("stub"),
    PUBLISH_PROVIDER: z.enum(["stub", "sanity"]).default("stub"),
    DRAFT_PROVIDER: z.enum(["stub", "openai"]).default("stub"),

    // Local storage provider config (optional unless provider=local)
    TEMP_STORAGE_LOCAL_DIR: optionalNonEmpty,

    OPENAI_API_KEY: optionalNonEmpty,
    OPENAI_PROJECT: optionalNonEmpty,
    OPENAI_ORGANIZATION: optionalNonEmpty,
    OPENAI_TRANSCRIPTION_MODEL: z.string().min(1).default("gpt-4o-mini-transcribe"),
    OPENAI_DRAFT_MODEL: z.string().min(1).default("gpt-4o-mini"),

    SANITY_PROJECT_ID: optionalNonEmpty,
    SANITY_DATASET: optionalNonEmpty,
    SANITY_API_VERSION: z.string().min(1).default("2024-01-01"),
    SANITY_READ_TOKEN: optionalNonEmpty,
  })
  .strict();

export type ServerEnv = z.infer<typeof envSchema>;

let cached: ServerEnv | null = null;

export function getServerEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = envSchema.safeParse({
    TEMP_STORAGE_PROVIDER: process.env.TEMP_STORAGE_PROVIDER,
    TRANSCRIPTION_PROVIDER: process.env.TRANSCRIPTION_PROVIDER,
    PUBLISH_PROVIDER: process.env.PUBLISH_PROVIDER,
    DRAFT_PROVIDER: process.env.DRAFT_PROVIDER,
    TEMP_STORAGE_LOCAL_DIR: process.env.TEMP_STORAGE_LOCAL_DIR,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_PROJECT: process.env.OPENAI_PROJECT,
    OPENAI_ORGANIZATION: process.env.OPENAI_ORGANIZATION,
    OPENAI_TRANSCRIPTION_MODEL: process.env.OPENAI_TRANSCRIPTION_MODEL,
    OPENAI_DRAFT_MODEL: process.env.OPENAI_DRAFT_MODEL,
    SANITY_PROJECT_ID: process.env.SANITY_PROJECT_ID,
    SANITY_DATASET: process.env.SANITY_DATASET,
    SANITY_API_VERSION: process.env.SANITY_API_VERSION,
    SANITY_READ_TOKEN: process.env.SANITY_READ_TOKEN,
  });
  if (!parsed.success) {
    throw new AppError("CONFIG_ERROR", "Invalid server environment configuration", 500, parsed.error.flatten());
  }

  if (parsed.data.TEMP_STORAGE_PROVIDER === "local" && !parsed.data.TEMP_STORAGE_LOCAL_DIR) {
    throw new AppError(
      "CONFIG_ERROR",
      "TEMP_STORAGE_LOCAL_DIR is required when TEMP_STORAGE_PROVIDER=local",
      500,
    );
  }

  if (
    (parsed.data.TRANSCRIPTION_PROVIDER === "openai" || parsed.data.DRAFT_PROVIDER === "openai") &&
    !parsed.data.OPENAI_API_KEY
  ) {
    throw new AppError(
      "CONFIG_ERROR",
      "OPENAI_API_KEY is required when TRANSCRIPTION_PROVIDER=openai or DRAFT_PROVIDER=openai",
      500,
    );
  }

  cached = parsed.data;
  return cached;
}

