import type { PublishListingPayload } from "@/lib/validation/listing-session";

export type PublishListingInput = {
  sessionId: string;
  payload: PublishListingPayload;
  mode: "draft" | "property";
  existingSanityDocumentId?: string | null;
};

export type PublishListingResult = {
  sanityDocumentId: string;
  action: "created" | "updated";
};

export interface ListingPublisher {
  publish(input: PublishListingInput): Promise<PublishListingResult>;
}

