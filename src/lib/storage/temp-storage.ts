import type {
  TempAssetContent,
  TempStorage,
  UploadTempAssetInput,
  UploadTempAssetResult,
} from "@/lib/storage/types";

const tempMemoryStore = new Map<string, TempAssetContent>();

export class InMemoryTempStorage implements TempStorage {
  async upload({ file, kind }: UploadTempAssetInput): Promise<UploadTempAssetResult> {
    const safeName = file.name.replace(/\s+/g, "-").toLowerCase();
    const storageKey = `mock/${kind}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    tempMemoryStore.set(storageKey, {
      storageKey,
      mimeType,
      bytes,
    });

    return {
      storageKey,
      url: `https://mock-storage.local/${storageKey}`,
    };
  }

  async read(storageKey: string) {
    return tempMemoryStore.get(storageKey) ?? null;
  }

  async delete(storageKey: string) {
    tempMemoryStore.delete(storageKey);
  }
}

