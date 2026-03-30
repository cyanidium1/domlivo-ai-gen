import { fail, ok } from "@/lib/api/response";
import { removeListingPhoto } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string; assetId: string }>;
};

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id, assetId } = await params;
    const result = await removeListingPhoto(id, assetId);
    return ok(result);
  } catch (error) {
    return fail(error);
  }
}
