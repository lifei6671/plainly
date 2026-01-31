export type TimestampValue = Date | string | number;

export interface Category {
  id: number;
  name: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}

export interface CategoryWithCount extends Category {
  count: number;
}

export interface DocumentMeta {
  document_id: number;
  name: string;
  category: number | string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  charCount?: number;
}

export interface NewDocumentPayload {
  name: string;
  category: number;
  charCount?: number;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
}

export interface UpdateDocumentMetaInput {
  name?: string;
  category?: number;
  updatedAt?: TimestampValue;
}

export type DataStoreMode = "browser" | "node" | "cloudflare" | "tauri";
