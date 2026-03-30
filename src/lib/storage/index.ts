import "server-only";

import { getServerEnv } from "@/lib/config/server";
import { unsupportedProvider } from "@/lib/errors/app-error";
import type { TempStorage } from "@/lib/storage/types";
import { LocalTempStorage } from "@/lib/storage/providers/local-temp-storage";
import { MemoryTempStorage } from "@/lib/storage/providers/memory-temp-storage";
import { R2TempStorage } from "@/lib/storage/providers/r2-temp-storage";
import { SupabaseTempStorage } from "@/lib/storage/providers/supabase-temp-storage";

const globalForStorage = global as unknown as { __domlivo_storage?: TempStorage };

export function getTempStorage(): TempStorage {
  if (globalForStorage.__domlivo_storage) return globalForStorage.__domlivo_storage;

  const env = getServerEnv();
  let instance: TempStorage;
  switch (env.TEMP_STORAGE_PROVIDER) {
    case "memory":
      instance = new MemoryTempStorage();
      break;
    case "local":
      instance = new LocalTempStorage(env.TEMP_STORAGE_LOCAL_DIR!);
      break;
    case "r2":
      instance = new R2TempStorage();
      break;
    case "supabase":
      instance = new SupabaseTempStorage();
      break;
    default:
      throw unsupportedProvider("temp storage", String(env.TEMP_STORAGE_PROVIDER));
  }

  globalForStorage.__domlivo_storage = instance;
  return instance;
}

