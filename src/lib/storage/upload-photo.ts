import "server-only";

import { getTempStorage } from "@/lib/storage";
import type { UploadTempAssetInput, UploadTempAssetResult } from "@/lib/storage/types";

export async function uploadTempAsset({
  file,
  kind,
}: UploadTempAssetInput): Promise<UploadTempAssetResult> {
  return getTempStorage().upload({ file, kind });
}

export async function uploadPhoto(file: File) {
  return uploadTempAsset({ file, kind: "photo" });
}
