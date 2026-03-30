import { fail } from "@/lib/api/response";
import { AppError } from "@/lib/errors/app-error";
import { getTempStorage } from "@/lib/storage";

type Params = {
  params: Promise<{ storageKey: string[] }>;
};

export async function GET(_: Request, { params }: Params) {
  try {
    const { storageKey } = await params;
    const key = storageKey.join("/");
    const content = await getTempStorage().read(key);
    if (!content) {
      throw new AppError("NOT_FOUND", "Temp asset not found", 404);
    }

    const buffer = content.bytes.buffer.slice(
      content.bytes.byteOffset,
      content.bytes.byteOffset + content.bytes.byteLength,
    ) as ArrayBuffer;

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": content.mimeType,
        "Cache-Control": "public, max-age=120",
      },
    });
  } catch (error) {
    return fail(error);
  }
}
