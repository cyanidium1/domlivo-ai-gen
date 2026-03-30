export type TranscriptionInput = {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
};

export type TranscriptionResult = {
  transcript: string;
  provider: string;
};

export interface Transcriber {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}

