import "server-only";

import type { TempStorage } from "@/lib/storage/types";
import { notImplemented } from "@/lib/errors/app-error";
import type { TempAssetContent, UploadTempAssetInput, UploadTempAssetResult } from "@/lib/storage/types";

export class R2TempStorage implements TempStorage {
  async upload(_: UploadTempAssetInput): Promise<UploadTempAssetResult> {
    throw notImplemented("R2TempStorage.upload is not implemented yet. Plug in Cloudflare R2 SDK here.");
  }
  async read(_: string): Promise<TempAssetContent | null> {
    throw notImplemented("R2TempStorage.read is not implemented yet. Plug in Cloudflare R2 SDK here.");
  }
  async delete(_: string): Promise<void> {
    throw notImplemented("R2TempStorage.delete is not implemented yet. Plug in Cloudflare R2 SDK here.");
  }
}

