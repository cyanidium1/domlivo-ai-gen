import "server-only";

import type { ListingPublisher, PublishListingInput, PublishListingResult } from "@/lib/publish/types";
import { notImplemented } from "@/lib/errors/app-error";

export class SanityListingPublisher implements ListingPublisher {
  async publish(_: PublishListingInput): Promise<PublishListingResult> {
    throw notImplemented("SanityListingPublisher is not implemented yet. Plug in Sanity client and mutations here.");
  }
}

