import "server-only";

import { getServerEnv } from "@/lib/config/server";
import { unsupportedProvider } from "@/lib/errors/app-error";
import type { Transcriber } from "@/lib/transcription/types";
import { OpenAITranscriber } from "@/lib/transcription/providers/openai-transcriber";
import { StubTranscriber } from "@/lib/transcription/providers/stub-transcriber";

let cached: Transcriber | null = null;

export function getTranscriber(): Transcriber {
  if (cached) return cached;

  const env = getServerEnv();
  switch (env.TRANSCRIPTION_PROVIDER) {
    case "stub":
      cached = new StubTranscriber();
      return cached;
    case "openai":
      cached = new OpenAITranscriber();
      return cached;
    default:
      throw unsupportedProvider("transcription", String(env.TRANSCRIPTION_PROVIDER));
  }
}

