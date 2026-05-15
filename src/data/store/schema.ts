/**
 * 统一定义浏览器 IndexedDB 与 Node/SQLite 的存储结构映射，避免两端字段或命名偏差。
 *
 * 浏览器端（IndexedDB）:
 *  - article_meta        -> 文档元数据
 *  - article_content     -> 文档正文
 *  - categories          -> 目录
 *  - users               -> 用户
 *  - articles            -> 旧版遗留表（仅迁移用）
 *
 * 后端（SQLite）:
 *  - documents           -> 文档元数据
 *  - document_content    -> 文档正文
 *  - categories          -> 目录
 *  - user_setting        -> 配置（原 localStorage）
 *  - users               -> 用户
 */

import {
  DocumentMeta,
  Category,
  UserSession,
  User,
  SourceType,
  DocumentShare,
  DocumentShareAsset,
  ShareAccessType,
  ShareDurationType,
} from "./types";

export const DEFAULT_USER_ID = 0;

export const IDBStores = {
  documentMeta: "article_meta",
  documentContent: "article_content",
  categories: "categories",
  users: "users",
  legacyArticles: "articles",
} as const;

export const SQLiteTables = {
  users: "users",
  documents: "documents",
  documentContent: "document_content",
  categories: "categories",
  settings: "user_setting",
  sessions: "user_sessions",
  documentShares: "document_shares",
  documentShareAssets: "document_share_assets",
} as const;

export interface SQLiteDocumentRow {
  id: number;
  user_id: number;
  document_id: string;
  name: string;
  category: number;
  category_id: string;
  created_at: number;
  updated_at: number;
  content_norm?: string | null;
  char_count?: number | null;
  source?: SourceType | string | null;
  version?: number | null;
}

export interface SQLiteCategoryRow {
  id: number;
  user_id: number;
  category_id: string;
  name: string;
  created_at: number;
  updated_at: number;
  source?: SourceType | string | null;
  version?: number | null;
}

export interface SQLiteSettingRow {
  id: number;
  user_id: number;
  key: string;
  value: string | null;
}

export interface SQLiteUserRow {
  id: number;
  account: string;
  password: string;
  password_salt?: string | null;
  registered_at: number;
  last_login_at?: number | null;
  last_login_ip?: string | null;
  status?: number | null;
  password_changed_at?: number | null;
  token_version?: number | null;
  updated_at: number;
}

export interface SQLiteSessionRow {
  id: string;
  user_id: number;
  device_id?: string | null;
  refresh_token_hash: string;
  created_at: number;
  expires_at: number;
  revoked_at?: number | null;
  last_seen_at?: number | null;
  ip?: string | null;
  ua?: string | null;
}

export interface SQLiteDocumentShareRow {
  id: number;
  user_id: number;
  document_id: string;
  share_id: string;
  enabled: number;
  listed: number;
  access_type: ShareAccessType;
  duration_type: ShareDurationType;
  start_at?: number | null;
  end_at?: number | null;
  password_hash?: string | null;
  password_salt?: string | null;
  password_algo?: "pbkdf2-sha256" | null;
  password_version?: number | null;
  html_snapshot?: string | null;
  title_snapshot?: string | null;
  excerpt_snapshot?: string | null;
  snapshot_version?: number | null;
  snapshot_hash?: string | null;
  last_snapshot_at?: number | null;
  created_at: number;
  updated_at: number;
}

export interface SQLiteDocumentShareAssetRow {
  id: number;
  user_id: number;
  document_id: string;
  asset_id: string;
  snapshot_hash: string;
  updated_at: number;
}

// SQLite DDL 统一来源，Node 端初始化时直接使用，避免手写分叉。
export const SQLiteDDL = {
  users: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.users} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      password_salt TEXT,
      registered_at INTEGER NOT NULL,
      last_login_at INTEGER,
      last_login_ip TEXT,
      status INTEGER NOT NULL DEFAULT 1,
      password_changed_at INTEGER,
      token_version INTEGER NOT NULL DEFAULT 1,
      updated_at INTEGER NOT NULL
    );
  `,
  sessions: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.sessions} (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      device_id TEXT,
      refresh_token_hash TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      revoked_at INTEGER,
      last_seen_at INTEGER,
      ip TEXT,
      ua TEXT,
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  categories: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.categories} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'remote',
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE (user_id, category_id),
      UNIQUE (user_id, name),
      UNIQUE (id, user_id),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  documents: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documents} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      name TEXT NOT NULL,
      category INTEGER NOT NULL,
      category_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      content_norm TEXT NOT NULL DEFAULT '',
      char_count INTEGER,
      source TEXT NOT NULL DEFAULT 'remote',
      version INTEGER NOT NULL DEFAULT 1,
      UNIQUE (user_id, document_id),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE,
      FOREIGN KEY (category, user_id) REFERENCES ${SQLiteTables.categories}(id, user_id)
    );
  `,
  documentContent: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documentContent} (
      document_row_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (document_row_id, user_id),
      FOREIGN KEY (document_row_id) REFERENCES ${SQLiteTables.documents}(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  settings: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.settings} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      UNIQUE (user_id, key),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  documentShares: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documentShares} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      share_id TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 0,
      listed INTEGER NOT NULL DEFAULT 0,
      access_type TEXT NOT NULL DEFAULT 'public',
      duration_type TEXT NOT NULL DEFAULT 'permanent',
      start_at INTEGER,
      end_at INTEGER,
      password_hash TEXT,
      password_salt TEXT,
      password_algo TEXT,
      password_version INTEGER,
      html_snapshot TEXT,
      title_snapshot TEXT,
      excerpt_snapshot TEXT,
      snapshot_version INTEGER,
      snapshot_hash TEXT,
      last_snapshot_at INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, document_id),
      UNIQUE (share_id),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  documentShareAssets: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documentShareAssets} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      document_id TEXT NOT NULL,
      asset_id TEXT NOT NULL,
      snapshot_hash TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (user_id, document_id, asset_id),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
};

const normalizeSource = (value?: string | null): SourceType | undefined => {
  if (value === "local" || value === "remote") return value;
  return undefined;
};

export const mapSqlDocToMeta = (row: SQLiteDocumentRow): DocumentMeta => ({
  id: row.id,
  document_id: row.document_id,
  name: row.name,
  category_id: row.category_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  charCount: row.char_count ?? undefined,
  source: normalizeSource(row.source as string | null),
  version: row.version ?? undefined,
  uid: row.user_id,
});

export const mapSqlCategory = (row: SQLiteCategoryRow): Category => ({
  id: row.id,
  category_id: row.category_id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  source: normalizeSource(row.source as string | null),
  version: row.version ?? undefined,
  uid: row.user_id,
});

export const mapSqlDocumentShare = (row: SQLiteDocumentShareRow): DocumentShare => ({
  id: row.id,
  documentId: row.document_id,
  shareId: row.share_id,
  enabled: Boolean(row.enabled),
  listed: Boolean(row.listed),
  accessType: row.access_type,
  durationType: row.duration_type,
  startAt: row.start_at ?? null,
  endAt: row.end_at ?? null,
  passwordHash: row.password_hash ?? null,
  passwordSalt: row.password_salt ?? null,
  passwordAlgo: row.password_algo ?? null,
  passwordVersion: row.password_version ?? null,
  htmlSnapshot: row.html_snapshot ?? null,
  titleSnapshot: row.title_snapshot ?? null,
  excerptSnapshot: row.excerpt_snapshot ?? null,
  snapshotVersion: row.snapshot_version ?? null,
  snapshotHash: row.snapshot_hash ?? null,
  lastSnapshotAt: row.last_snapshot_at ?? null,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  uid: row.user_id,
});

export const mapSqlDocumentShareAsset = (row: SQLiteDocumentShareAssetRow): DocumentShareAsset => ({
  id: row.id,
  documentId: row.document_id,
  assetId: row.asset_id,
  snapshotHash: row.snapshot_hash,
  updatedAt: row.updated_at,
  uid: row.user_id,
});
