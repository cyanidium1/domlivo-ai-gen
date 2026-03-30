import { fail, ok } from "@/lib/api/response";
import { publishListingSession } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const updated = await publishListingSession(id);
    return ok(updated);
  } catch (error) {
    return fail(error);
  }
}
