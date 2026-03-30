export class AppError extends Error {
  code: string;
  status: number;
  details?: unknown;

  constructor(code: string, message: string, status = 400, details?: unknown) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function configError(message: string, details?: unknown) {
  return new AppError("CONFIG_ERROR", message, 500, details);
}

export function unsupportedProvider(kind: string, provider: string) {
  return new AppError("UNSUPPORTED_PROVIDER", `${kind} provider "${provider}" is not supported`, 500);
}

export function notImplemented(message: string, details?: unknown) {
  return new AppError("NOT_IMPLEMENTED", message, 501, details);
}

export function externalProviderFailure(message: string, details?: unknown) {
  return new AppError("EXTERNAL_PROVIDER_FAILURE", message, 502, details);
}
