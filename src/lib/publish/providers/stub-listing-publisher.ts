import type { ListingPublisher, PublishListingInput, PublishListingResult } from "@/lib/publish/types";
import { AppError } from "@/lib/errors/app-error";

export class StubListingPublisher implements ListingPublisher {
  async publish(_: PublishListingInput): Promise<PublishListingResult> {
    throw new AppError(
      "PUBLISH_FAILED",
      "PUBLISH_PROVIDER=stub does not persist to Sanity. Switch to PUBLISH_PROVIDER=sanity for real create/update.",
      500,
    );
  }
}

