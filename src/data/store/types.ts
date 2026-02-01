export type TimestampValue = Date | string | number;
export type SourceType = "local" | "remote";

export interface Category {
  id: number;
  category_id: string;
  name: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  source?: SourceType;
  version?: number;
  uid?: number;
}

export interface CategoryWithCount extends Category {
  count: number;
}

export interface DocumentMeta {
  id?: number;
  document_id: string;
  name: string;
  category_id: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  charCount?: number;
  source?: SourceType;
  version?: number;
  uid?: number;
}

export interface RenameDocumentPayload {
  meta: DocumentMeta | null;
  categories: Category[];
}

export interface NewDocumentPayload {
  document_id?: string;
  name: string;
  category_id: string;
  charCount?: number;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  source?: SourceType;
  version?: number;
  uid?: number;
}

export interface UpdateDocumentMetaInput {
  name?: string;
  category_id?: string;
  updatedAt?: TimestampValue;
  charCount?: number;
  source?: SourceType;
  version?: number;
  uid?: number;
}

export interface BatchCreateCategoryInput {
  name: string;
  category_id?: string;
  source?: SourceType;
  version?: number;
}

export interface BatchCreateCategoryResult {
  client_id?: string;
  category?: Category;
  error?: string;
}

export interface BatchCreateCategoriesResponse {
  items: BatchCreateCategoryResult[];
}

export interface BatchCreateDocumentInput {
  meta: NewDocumentPayload;
  content: string;
}

export interface BatchCreateDocumentResult {
  client_id?: string;
  document?: DocumentMeta;
  error?: string;
}

export interface BatchCreateDocumentsResponse {
  items: BatchCreateDocumentResult[];
}

export interface User {
  id: number;
  account: string;
  password?: string;
  registeredAt: TimestampValue;
  lastLoginAt?: TimestampValue | null;
  lastLoginIp?: string | null;
  status?: number;
  passwordChangedAt?: TimestampValue | null;
  tokenVersion?: number;
}

export interface UserSession {
  id: string;
  userId: number;
  deviceId?: string | null;
  refreshTokenHash: string;
  createdAt: TimestampValue;
  expiresAt: TimestampValue;
  revokedAt?: TimestampValue | null;
  lastSeenAt?: TimestampValue | null;
  ip?: string | null;
  ua?: string | null;
}

export type DataStoreMode = "browser" | "remote" | "node" | "cloudflare" | "tauri";
