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
 * @deprecated Prefer buildVisualContextForPrompt — inject before generation instead of appending after.
 */
export function buildImageEnrichmentText(result: ImageFeatureResult): string | null {
  if (!result.descriptions.length) return null;
  return result.descriptions.join(" ");
}

/**
 * Formats image analysis results as a prompt section to be injected into the
 * generator before generation runs. This lets the model incorporate visual
 * observations naturally into every locale's description rather than appending
 * raw English text afterwards.
 *
 * Returns null when there are no descriptions to include.
 */
export function buildVisualContextForPrompt(result: ImageFeatureResult): string | null {
  if (!result.descriptions.length) return null;
  const bullets = result.descriptions.map((d, i) => `  • Photo ${i + 1}: ${d}`).join("\n");
  return [
    "VISUAL SIGNALS (extracted from uploaded photos via vision analysis):",
    bullets,
    "Use these observations as factual inputs when writing descriptions in ALL locales.",
    "Mention relevant visual features (views, finishes, layout, condition) naturally in each language.",
    "Do NOT translate the signal text — write about these features directly in each target language.",
  ].join("\n");
}
