import type { ListingPublisher, PublishListingInput, PublishListingResult } from "@/lib/publish/types";
import { publishListing } from "@/lib/sanity/publish-listing";

export class StubListingPublisher implements ListingPublisher {
  async publish(input: PublishListingInput): Promise<PublishListingResult> {
    const result = await publishListing(input);
    return { sanityDocumentId: result.sanityDocumentId };
  }
}

