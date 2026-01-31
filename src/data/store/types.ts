export type TimestampValue = Date | string | number;

export interface Category {
  id: number;
  name: string;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  uid?: number;
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
  uid?: number;
}

export interface NewDocumentPayload {
  name: string;
  category: number;
  charCount?: number;
  createdAt: TimestampValue;
  updatedAt: TimestampValue;
  uid?: number;
}

export interface UpdateDocumentMetaInput {
  name?: string;
  category?: number;
  updatedAt?: TimestampValue;
  charCount?: number;
  uid?: number;
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
