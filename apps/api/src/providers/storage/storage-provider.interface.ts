/** docs/architecture.md §4 — StorageProvider: MVP реалізація S3StorageProvider (S3-compatible / MinIO для dev). */
export interface FileMeta {
  key: string;
  mimeType: string;
  sizeBytes: number;
}

export interface StoredFile {
  key: string;
  url: string;
}

export interface StorageProvider {
  upload(file: Buffer, meta: FileMeta): Promise<StoredFile>;
  delete(key: string): Promise<void>;
  getSignedUrl(key: string): Promise<string>;
}

export const STORAGE_PROVIDER = 'STORAGE_PROVIDER';
