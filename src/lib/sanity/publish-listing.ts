import type { PublishListingPayload } from "@/lib/validation/listing-session";
import { AppError } from "@/lib/errors/app-error";

type PublishListingInput = {
  sessionId: string;
  payload: PublishListingPayload;
};

export async function publishListing({ sessionId, payload }: PublishListingInput) {
  throw new AppError(
    "NOT_IMPLEMENTED",
    `Legacy publishListing() is deprecated and should not be called (sessionId=${sessionId}, payloadKeys=${Object.keys(payload).length}).`,
    500,
  );
}
