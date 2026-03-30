import type { Transcriber, TranscriptionInput, TranscriptionResult } from "@/lib/transcription/types";

export class StubTranscriber implements Transcriber {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const { bytes, fileName, mimeType } = input;

    if (mimeType.startsWith("text/") || fileName.toLowerCase().endsWith(".txt")) {
      const text = new TextDecoder().decode(bytes);
      return { transcript: text.trim(), provider: "stub" };
    }

    return {
      transcript: `Stub transcript for "${fileName}" (${mimeType || "unknown"}, ${bytes.byteLength} bytes).`,
      provider: "stub",
    };
  }
}

