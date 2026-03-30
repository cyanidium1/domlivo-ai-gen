import type { PublishListingPayload } from "@/lib/validation/listing-session";

export type PublishListingInput = {
  sessionId: string;
  payload: PublishListingPayload;
};

export type PublishListingResult = {
  sanityDocumentId: string;
};

export interface ListingPublisher {
  publish(input: PublishListingInput): Promise<PublishListingResult>;
}

