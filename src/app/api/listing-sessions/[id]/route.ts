import { fail, ok } from "@/lib/api/response";
import { getListingSessionOrThrow, patchListingSession } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const session = await getListingSessionOrThrow(id);
    return ok(session);
  } catch (error) {
    return fail(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const updated = await patchListingSession(id, body);
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
