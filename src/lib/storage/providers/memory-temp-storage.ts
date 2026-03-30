import type { TempAssetContent, TempStorage, UploadTempAssetInput, UploadTempAssetResult } from "@/lib/storage/types";

const globalForMemory = global as unknown as { __domlivo_memStore?: Map<string, TempAssetContent> };
if (!globalForMemory.__domlivo_memStore) {
  globalForMemory.__domlivo_memStore = new Map<string, TempAssetContent>();
}
const store = globalForMemory.__domlivo_memStore;

export class MemoryTempStorage implements TempStorage {
  async upload({ file, kind }: UploadTempAssetInput): Promise<UploadTempAssetResult> {
    const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
    const storageKey = `memory/${kind}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    store.set(storageKey, { storageKey, mimeType, bytes });

    return { storageKey, url: `https://mock-storage.local/${storageKey}` };
  }

  async read(storageKey: string) {
    return store.get(storageKey) ?? null;
  }

  async delete(storageKey: string) {
    store.delete(storageKey);
  }
}

