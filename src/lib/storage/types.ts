export type TempAssetKind = "photo" | "audio";

export type UploadTempAssetInput = {
  file: File;
  kind: TempAssetKind;
};

export type UploadTempAssetResult = {
  storageKey: string;
  url: string;
};

export type TempAssetContent = {
  storageKey: string;
  mimeType: string;
  bytes: Uint8Array;
};

export interface TempStorage {
  upload(input: UploadTempAssetInput): Promise<UploadTempAssetResult>;
  read(storageKey: string): Promise<TempAssetContent | null>;
  delete(storageKey: string): Promise<void>;
}

