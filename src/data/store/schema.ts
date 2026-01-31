/**
 * 统一定义浏览器 IndexedDB 与 Node/SQLite 的存储结构映射，避免两端字段或命名偏差。
 *
 * 浏览器端（IndexedDB）:
 *  - article_meta        -> 文档元数据
 *  - article_content     -> 文档正文
 *  - categories          -> 目录
 *  - articles            -> 旧版遗留表（仅迁移用）
 *
 * 后端（SQLite）:
 *  - documents           -> 文档元数据
 *  - document_content    -> 文档正文
 *  - categories          -> 目录
 *  - user_setting        -> 配置（原 localStorage）
 */

import {DocumentMeta, Category} from "./types";

export const IDBStores = {
  documentMeta: "article_meta",
  documentContent: "article_content",
  categories: "categories",
  legacyArticles: "articles",
} as const;

export const SQLiteTables = {
  documents: "documents",
  documentContent: "document_content",
  categories: "categories",
  settings: "user_setting",
} as const;

export interface SQLiteDocumentRow {
  id: number;
  name: string;
  category: number;
  created_at: number;
  updated_at: number;
  char_count?: number | null;
}

export interface SQLiteCategoryRow {
  id: number;
  name: string;
  created_at: number;
  updated_at: number;
}

export interface SQLiteSettingRow {
  key: string;
  value: string | null;
}

export const mapSqlDocToMeta = (row: SQLiteDocumentRow): DocumentMeta => ({
  document_id: row.id,
  name: row.name,
  category: row.category,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  charCount: row.char_count ?? undefined,
});

export const mapSqlCategory = (row: SQLiteCategoryRow): Category => ({
  id: row.id,
  name: row.name,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});
