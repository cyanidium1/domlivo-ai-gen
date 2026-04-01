import { fail, ok } from "@/lib/api/response";
import { publishListingSessionDraft } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const result = await publishListingSessionDraft(id);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
