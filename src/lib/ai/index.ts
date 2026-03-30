import "server-only";

import { getServerEnv } from "@/lib/config/server";
import { unsupportedProvider } from "@/lib/errors/app-error";
import type { DraftGenerator } from "@/lib/ai/types";
import { OpenAIDraftGenerator } from "@/lib/ai/providers/openai-draft-generator";
import { StubDraftGenerator } from "@/lib/ai/providers/stub-draft-generator";

let cached: DraftGenerator | null = null;

export function getDraftGenerator(): DraftGenerator {
  if (cached) return cached;

  const env = getServerEnv();
  switch (env.DRAFT_PROVIDER) {
    case "stub":
      cached = new StubDraftGenerator();
      return cached;
    case "openai":
      cached = new OpenAIDraftGenerator();
      return cached;
    default:
      throw unsupportedProvider("draft", String(env.DRAFT_PROVIDER));
  }
}

