import type { PublishListingPayload } from "@/lib/validation/listing-session";

type PublishListingInput = {
  sessionId: string;
  payload: PublishListingPayload;
};

export async function publishListing({ sessionId, payload }: PublishListingInput) {
  const sanityDocumentId = `sanity-${sessionId}-${Date.now()}`;

  return {
    sanityDocumentId,
    payload: {
      _type: "propertyListing",
      ...payload,
    },
  };
}
