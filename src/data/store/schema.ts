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

import {DocumentMeta, Category, UserSession, User} from "./types";

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
} as const;

export interface SQLiteDocumentRow {
  id: number;
  user_id: number;
  name: string;
  category: number;
  created_at: number;
  updated_at: number;
  char_count?: number | null;
}

export interface SQLiteCategoryRow {
  id: number;
  user_id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface SQLiteSettingRow {
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
      user_id INTEGER NOT NULL,
      id INTEGER NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (user_id, id),
      UNIQUE (user_id, name),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  documents: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documents} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      category INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      char_count INTEGER,
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE,
      FOREIGN KEY (category, user_id) REFERENCES ${SQLiteTables.categories}(id, user_id)
    );
  `,
  documentContent: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.documentContent} (
      document_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      PRIMARY KEY (document_id, user_id),
      FOREIGN KEY (document_id) REFERENCES ${SQLiteTables.documents}(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
  settings: `
    CREATE TABLE IF NOT EXISTS ${SQLiteTables.settings} (
      user_id INTEGER NOT NULL,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key),
      FOREIGN KEY (user_id) REFERENCES ${SQLiteTables.users}(id) ON DELETE CASCADE
    );
  `,
};

export const mapSqlDocToMeta = (row: SQLiteDocumentRow): DocumentMeta => ({
  document_id: row.id,
  name: row.name,
  category: row.category,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  charCount: row.char_count ?? undefined,
  uid: row.user_id,
});

export const mapSqlCategory = (row: SQLiteCategoryRow): Category => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  uid: row.user_id,
});
