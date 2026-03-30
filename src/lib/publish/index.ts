import "server-only";

import { getServerEnv } from "@/lib/config/server";
import { unsupportedProvider } from "@/lib/errors/app-error";
import type { ListingPublisher } from "@/lib/publish/types";
import { SanityListingPublisher } from "@/lib/publish/providers/sanity-listing-publisher";
import { StubListingPublisher } from "@/lib/publish/providers/stub-listing-publisher";

let cached: ListingPublisher | null = null;

export function getListingPublisher(): ListingPublisher {
  if (cached) return cached;

  const env = getServerEnv();
  switch (env.PUBLISH_PROVIDER) {
    case "stub":
      cached = new StubListingPublisher();
      return cached;
    case "sanity":
      cached = new SanityListingPublisher();
      return cached;
    default:
      throw unsupportedProvider("publish", String(env.PUBLISH_PROVIDER));
  }
}

