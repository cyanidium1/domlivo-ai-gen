import { AppError, externalProviderFailure } from "@/lib/errors/app-error";

type MaybeOpenAIError = {
  status?: number;
  message?: string;
  code?: string;
  type?: string;
};

export function mapOpenAIError(error: unknown, scope: string): AppError {
  if (error instanceof AppError) return error;

  const e = error as MaybeOpenAIError;
  const details = {
    scope,
    status: e?.status,
    code: e?.code,
    type: e?.type,
  };

  return externalProviderFailure(
    `${scope} failed: ${e?.message || "OpenAI provider error"}`,
    details,
  );
}

