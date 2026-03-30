import "server-only";

import { getOpenAIClient } from "@/lib/openai/client";
import { getServerEnv } from "@/lib/config/server";

export type ImageFeatureResult = {
  descriptions: string[];
};

/**
 * Analyzes up to 4 property images using OpenAI vision.
 * Only runs when DRAFT_PROVIDER=openai — returns empty result otherwise.
 * Never throws: failures are logged and skipped.
 */
export async function analyzePropertyImages(
  images: Array<{ bytes: Uint8Array; mimeType: string }>,
): Promise<ImageFeatureResult> {
  if (!images.length) return { descriptions: [] };

  try {
    const env = getServerEnv();
    if (env.DRAFT_PROVIDER !== "openai") return { descriptions: [] };

    const client = getOpenAIClient();
    const descriptions: string[] = [];

    for (const img of images.slice(0, 4)) {
      try {
        const base64 = Buffer.from(img.bytes).toString("base64");
        const mimeType = img.mimeType || "image/jpeg";
        const dataUrl = `data:${mimeType};base64,${base64}`;

        const response = await client.responses.create({
          model: env.OPENAI_DRAFT_MODEL,
          input: [
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: "Describe this real estate property photo in 1-2 sentences. Mention the room type, visible features, condition, finishes, appliances, view, or special attributes. Be factual. Do not mention people.",
                },
                {
                  type: "input_image",
                  image_url: dataUrl,
                  detail: "low" as const,
                },
              ],
            },
          ],
        });

        const text = response.output_text?.trim();
        if (text) descriptions.push(text);
      } catch (err) {
        console.warn(
          "[image-analyzer] skipping one image:",
          err instanceof Error ? err.message : String(err),
        );
      }
    }

    console.info("[image-analyzer] analyzed", descriptions.length, "of", Math.min(images.length, 4), "images");
    return { descriptions };
  } catch (err) {
    console.warn("[image-analyzer] analysis skipped:", err instanceof Error ? err.message : String(err));
    return { descriptions: [] };
  }
}

/**
 * Builds an enrichment paragraph from image analysis results to append to the
 * property description. Returns null if there's nothing to add.
 */
export function buildImageEnrichmentText(result: ImageFeatureResult): string | null {
  if (!result.descriptions.length) return null;
  return result.descriptions.join(" ");
}
