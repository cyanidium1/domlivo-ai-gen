import { fail, ok } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { transcribeListingAudio } from "@/lib/listing-session/service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new AppError("VALIDATION_ERROR", "file is required", 400);
    }

    const transcript = await transcribeListingAudio(id, file);
    return ok(transcript);
  } catch (error) {
    return fail(error);
  }
}
