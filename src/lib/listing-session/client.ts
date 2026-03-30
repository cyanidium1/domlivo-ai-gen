import type { ListingDraft } from "@/lib/validation/listing-session";
import type { ExtractedFacts } from "@/lib/validation/extracted-facts";
import type { PublishGateErrors } from "@/lib/listing-session/publish-payload";

export type ListingSessionResponse = {
  id: string;
  status: string;
  sourceText: string | null;
  transcript: string | null;
  extractedFacts: ExtractedFacts | null;
  generatedDraft: ListingDraft | null;
  editedDraft: ListingDraft | null;
  confirmation: Record<string, boolean> | null;
  sanityDocumentId: string | null;
  assets: Array<{ id: string; fileName: string; storageKey: string }>;
};

export type IntakeAnalysisResponse = {
  knownFacts: ExtractedFacts;
  missingRequiredFacts: Array<
    "price" | "dealStatus" | "city" | "propertyType" | "area" | "photo"
  >;
  missingOptionalFacts: Array<
    | "bedrooms"
    | "bathrooms"
    | "yearBuilt"
    | "district"
    | "displayAddress"
    | "streetLine"
    | "postalCode"
  >;
  questionsForUser: string[];
  isReadyForDraft: boolean;
  isReadyForTextDraft: boolean;
  referenceMessages: string[];
  /** Available city names from Sanity — used by client to build localized city question. */
  cityNames: string[];
  /** Available property type names from Sanity — used by client to build localized type question. */
  propertyTypeNames: string[];
};

export type IntakeResultResponse = {
  session: ListingSessionResponse;
  intake: IntakeAnalysisResponse;
};

type ApiErrorJson = {
  error?: { code?: string; message?: string; details?: PublishGateErrors | unknown | null };
};

export type ApiErrorWithDetails = Error & { details?: PublishGateErrors | unknown };

async function readApiError(response: Response): Promise<{ message: string; details?: unknown }> {
  const data = (await response.json().catch(() => ({}))) as ApiErrorJson;
  return {
    message: data?.error?.message || "Request failed",
    details: data?.error?.details ?? undefined,
  };
}

export function isPublishGateErrors(v: unknown): v is PublishGateErrors {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.missing) && Array.isArray(o.invalid) && Array.isArray(o.unconfirmed);
}

export async function getSession(id: string): Promise<ListingSessionResponse> {
  const response = await fetch(`/api/listing-sessions/${id}`, { cache: "no-store" });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function patchSession(
  id: string,
  payload: { sourceText?: string; editedDraft?: ListingDraft; confirmationSet?: string[]; confirmationUnset?: string[] },
) {
  const response = await fetch(`/api/listing-sessions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function generateSession(id: string) {
  const response = await fetch(`/api/listing-sessions/${id}/generate`, { method: "POST" });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function runIntake(id: string): Promise<IntakeResultResponse> {
  const response = await fetch(`/api/listing-sessions/${id}/intake`, { method: "POST" });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function publishSession(id: string) {
  const response = await fetch(`/api/listing-sessions/${id}/publish`, { method: "POST" });
  if (!response.ok) {
    const { message, details } = await readApiError(response);
    const err: ApiErrorWithDetails = new Error(message);
    err.details = details;
    throw err;
  }
  return response.json();
}

export async function publishDraftSession(id: string) {
  const response = await fetch(`/api/listing-sessions/${id}/publish-draft`, { method: "POST" });
  if (!response.ok) {
    const { message, details } = await readApiError(response);
    const err: ApiErrorWithDetails = new Error(message);
    err.details = details;
    throw err;
  }
  return response.json();
}

export async function uploadAudio(id: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/listing-sessions/${id}/audio`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function transcribeAudio(id: string, file: File): Promise<{ transcript: string; provider: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`/api/listing-sessions/${id}/transcribe`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function uploadPhotos(id: string, files: File[]) {
  if (!files.length) return [];
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }
  const response = await fetch(`/api/listing-sessions/${id}/photos`, {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}

export async function removePhoto(id: string, assetId: string) {
  const response = await fetch(`/api/listing-sessions/${id}/photos/${assetId}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const { message } = await readApiError(response);
    throw new Error(message);
  }
  return response.json();
}
