import "server-only";

import type { ListingPublisher, PublishListingInput, PublishListingResult } from "@/lib/publish/types";
import { createClient, type SanityClient } from "@sanity/client";

import { AppError } from "@/lib/errors/app-error";
import { getServerEnv } from "@/lib/config/server";
import { getTempStorage } from "@/lib/storage";
import { buildSanityPropertyMutation, type SanityPropertyDocument } from "@/lib/publish/sanity-mutation-builder";
import { resolveLifecycleForMode, resolveTargetDocumentId } from "@/lib/publish/persist-logic";

function resolveWriteClient(): SanityClient {
  const env = getServerEnv();
  const token = env.SANITY_WRITE_TOKEN ?? env.SANITY_API_TOKEN ?? undefined;
  if (!env.SANITY_PROJECT_ID || !env.SANITY_DATASET || !token) {
    throw new AppError("CONFIG_ERROR", "Sanity write client is not configured for publish", 500);
  }
  return createClient({
    projectId: env.SANITY_PROJECT_ID,
    dataset: env.SANITY_DATASET,
    apiVersion: env.SANITY_API_VERSION,
    useCdn: false,
    token,
  });
}

async function resolveGalleryAssetRefs(client: SanityClient, input: PublishListingInput): Promise<PublishListingInput["payload"]> {
  const storage = getTempStorage();
  const refMap = new Map<string, string>();
  const gallery = input.payload.gallery;
  const mappedGallery = await Promise.all(
    gallery.map(async (item, idx) => {
      const ref = item.image.asset._ref;
      if (!ref.startsWith("temp:")) return item;
      const storageKey = ref.slice("temp:".length);
      const file = await storage.read(storageKey);
      if (!file) {
        throw new AppError("PUBLISH_FAILED", `Temp image bytes not found for key: ${storageKey}`, 500);
      }
      const uploaded = await client.assets.upload("image", Buffer.from(file.bytes), {
        filename: `${input.sessionId}-${idx + 1}.jpg`,
        contentType: file.mimeType,
      });
      refMap.set(ref, uploaded._id);
      return {
        ...item,
        image: {
          ...item.image,
          asset: {
            ...item.image.asset,
            _ref: uploaded._id,
          },
        },
      };
    }),
  );

  const coverRef = input.payload.coverImage?.asset._ref;
  let nextCover = input.payload.coverImage;
  if (coverRef?.startsWith("temp:")) {
    const mappedCoverRef = refMap.get(coverRef);
    if (mappedCoverRef) {
      nextCover = {
        _type: "image",
        asset: { _type: "reference", _ref: mappedCoverRef },
      };
    } else {
      const storageKey = coverRef.slice("temp:".length);
      const file = await storage.read(storageKey);
      if (!file) {
        throw new AppError("PUBLISH_FAILED", `Temp cover bytes not found for key: ${storageKey}`, 500);
      }
      const uploaded = await client.assets.upload("image", Buffer.from(file.bytes), {
        filename: `${input.sessionId}-cover.jpg`,
        contentType: file.mimeType,
      });
      nextCover = {
        _type: "image",
        asset: { _type: "reference", _ref: uploaded._id },
      };
    }
  }

  return {
    ...input.payload,
    gallery: mappedGallery,
    ...(nextCover ? { coverImage: nextCover } : {}),
  };
}

export class SanityListingPublisher implements ListingPublisher {
  async publish(input: PublishListingInput): Promise<PublishListingResult> {
    const client = resolveWriteClient();
    const target = resolveTargetDocumentId(input);

    console.info(
      "[publish][sanity] request",
      JSON.stringify({
        sessionId: input.sessionId,
        mode: input.mode,
        existingSanityDocumentId: input.existingSanityDocumentId ?? null,
        targetDocumentId: target.id,
        action: target.action,
      }),
    );

    const payloadWithRealAssets = await resolveGalleryAssetRefs(client, input);
    const built = buildSanityPropertyMutation(payloadWithRealAssets, {
      defaultAgentId: getServerEnv().SANITY_DEFAULT_AGENT_ID,
      mode: input.mode,
    });
    const existing = (await client.getDocument<{ createdAt?: string; _id: string }>(target.id).catch(() => null)) ?? null;
    const lifecycle = resolveLifecycleForMode(input.mode);
    const doc: SanityPropertyDocument & { _id: string } = {
      ...built,
      _id: target.id,
      isPublished: lifecycle.isPublished,
      lifecycleStatus: lifecycle.lifecycleStatus,
      createdAt: existing?.createdAt ?? built.createdAt,
    };

    await client.createOrReplace(doc);

    const persisted = await client.getDocument<{ _id: string; _type: string; isPublished?: boolean; lifecycleStatus?: string }>(
      target.id,
    );
    if (!persisted || persisted._type !== "property") {
      throw new AppError("PUBLISH_FAILED", "Sanity write did not persist a property document", 502);
    }

    console.info(
      "[publish][sanity] success",
      JSON.stringify({
        sessionId: input.sessionId,
        mode: input.mode,
        sanityDocumentId: persisted._id,
        isPublished: persisted.isPublished ?? null,
        lifecycleStatus: persisted.lifecycleStatus ?? null,
      }),
    );

    return { sanityDocumentId: persisted._id, action: target.action };
  }
}

