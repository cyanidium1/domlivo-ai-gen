import "server-only";

import type { Transcriber, TranscriptionInput, TranscriptionResult } from "@/lib/transcription/types";
import { getOpenAIClient } from "@/lib/openai/client";
import { mapOpenAIError } from "@/lib/openai/error";
import { getServerEnv } from "@/lib/config/server";
import { AppError } from "@/lib/errors/app-error";

export class OpenAITranscriber implements Transcriber {
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    try {
      const env = getServerEnv();
      const client = getOpenAIClient();
      const bytesBuffer = input.bytes.buffer.slice(
        input.bytes.byteOffset,
        input.bytes.byteOffset + input.bytes.byteLength,
      ) as ArrayBuffer;

      const file = new File([bytesBuffer], input.fileName, {
        type: input.mimeType || "audio/mpeg",
      });

      console.info(
        "[ai][transcription] request",
        JSON.stringify({
          stage: "transcription",
          model: env.OPENAI_TRANSCRIPTION_MODEL,
          fileName: input.fileName,
          mimeType: input.mimeType,
          bytes: input.bytes.byteLength,
        }),
      );

      const response = await client.audio.transcriptions.create({
        file,
        model: env.OPENAI_TRANSCRIPTION_MODEL,
      });

      const transcript = response.text?.trim();
      if (!transcript) {
        throw new AppError("EXTERNAL_PROVIDER_FAILURE", "OpenAI transcription returned empty text", 502);
      }

      console.info(
        "[ai][transcription] response",
        JSON.stringify({
          stage: "transcription",
          model: env.OPENAI_TRANSCRIPTION_MODEL,
          transcriptLen: transcript.length,
        }),
      );

      return {
        transcript,
        provider: `openai:${env.OPENAI_TRANSCRIPTION_MODEL}`,
      };
    } catch (error) {
      console.error("[openai-transcriber] transcription failed");
      throw mapOpenAIError(error, "openai transcription");
    }
  }
}

