import "server-only";

import OpenAI from "openai";

import { getServerEnv } from "@/lib/config/server";

let cached: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cached) return cached;

  const env = getServerEnv();
  cached = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
    project: env.OPENAI_PROJECT,
    organization: env.OPENAI_ORGANIZATION,
  });

  return cached;
}

