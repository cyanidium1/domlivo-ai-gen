import "server-only";

import type { TempStorage } from "@/lib/storage/types";
import { notImplemented } from "@/lib/errors/app-error";
import type { TempAssetContent, UploadTempAssetInput, UploadTempAssetResult } from "@/lib/storage/types";

export class SupabaseTempStorage implements TempStorage {
  async upload(_: UploadTempAssetInput): Promise<UploadTempAssetResult> {
    throw notImplemented("SupabaseTempStorage.upload is not implemented yet. Plug in Supabase Storage SDK here.");
  }
  async read(_: string): Promise<TempAssetContent | null> {
    throw notImplemented("SupabaseTempStorage.read is not implemented yet. Plug in Supabase Storage SDK here.");
  }
  async delete(_: string): Promise<void> {
    throw notImplemented("SupabaseTempStorage.delete is not implemented yet. Plug in Supabase Storage SDK here.");
  }
}

