import { fail, ok } from "@/lib/api/response";
import { createListingSession } from "@/lib/listing-session/service";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const session = await createListingSession(body);
    return ok(session, 201);
  } catch (error) {
    return fail(error);
  }
}
