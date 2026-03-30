import { fail, ok } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { uploadListingPhoto } from "@/lib/listing-session/service";

type Params = {
  params: Promise<{ id: string }>;
};

export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!files.length) {
      const single = formData.get("file");
      if (single instanceof File) {
        files.push(single);
      }
    }

    if (!files.length) {
      throw new AppError("VALIDATION_ERROR", "File is required", 400);
    }

    const assets = await Promise.all(files.map((file) => uploadListingPhoto(id, file)));
    return ok(assets, 201);
  } catch (error) {
    return fail(error);
  }
}
