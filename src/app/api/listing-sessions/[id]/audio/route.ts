import { fail, ok } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { uploadListingAudio } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "File is required", 400);
    }

    const asset = await uploadListingAudio(id, file);
    return ok(asset, 201);
  } catch (error) {
    return fail(error);
  }
}

