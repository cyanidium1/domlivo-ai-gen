import "server-only";

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { TempAssetContent, TempStorage, UploadTempAssetInput, UploadTempAssetResult } from "@/lib/storage/types";

function safeSegment(input: string) {
  return input.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export class LocalTempStorage implements TempStorage {
  constructor(private baseDir: string) {}

  private filePath(storageKey: string) {
    // storageKey is used only as an identifier; it must not escape baseDir.
    const rel = storageKey.split("/").map(safeSegment).join("/");
    return join(this.baseDir, rel);
  }

  async upload({ file, kind }: UploadTempAssetInput): Promise<UploadTempAssetResult> {
    const safeName = safeSegment(file.name.toLowerCase());
    const storageKey = `local/${kind}/${Date.now()}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const mimeType = file.type || "application/octet-stream";

    const path = this.filePath(storageKey);
    await mkdir(join(path, ".."), { recursive: true }).catch(async () => {
      // Fallback for Windows path handling where join(path,"..") can be odd; ensure baseDir exists.
      await mkdir(this.baseDir, { recursive: true });
    });
    await mkdir(join(this.baseDir, "local", kind), { recursive: true });
    await writeFile(path, bytes);
    await writeFile(`${path}.meta.json`, JSON.stringify({ mimeType }, null, 2));

    return { storageKey, url: `https://mock-storage.local/${storageKey}` };
  }

  async read(storageKey: string): Promise<TempAssetContent | null> {
    try {
      const path = this.filePath(storageKey);
      const bytes = new Uint8Array(await readFile(path));

      let mimeType = "application/octet-stream";
      try {
        const meta = JSON.parse(await readFile(`${path}.meta.json`, "utf8"));
        if (typeof meta?.mimeType === "string" && meta.mimeType) mimeType = meta.mimeType;
      } catch {
        // ignore
      }

      return { storageKey, mimeType, bytes };
    } catch {
      return null;
    }
  }

  async delete(storageKey: string): Promise<void> {
    const path = this.filePath(storageKey);
    await rm(path, { force: true }).catch(() => {});
    await rm(`${path}.meta.json`, { force: true }).catch(() => {});
  }
}

