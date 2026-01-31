import Database from "better-sqlite3";
import path from "path";
import {
  Category,
  CategoryWithCount,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
} from "../data/store/types";
import {IDataStore} from "../data/store/IDataStore";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../utils/constant";
import {
  SQLiteTables,
  SQLiteDocumentRow,
  SQLiteCategoryRow,
  mapSqlDocToMeta,
  mapSqlCategory,
} from "../data/store/schema";

type TimestampValue = Date | string | number;

const toMillis = (v: TimestampValue | null | undefined): number => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const num = Number(v);
    if (Number.isFinite(num)) return num;
  }
  return Date.now();
};

export class NodeDataStore implements IDataStore {
  private db: Database.Database;

  constructor(dbFile = "data/plainly.db") {
    const file = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
    // 若同名存在旧 json/小文件会导致 “file is not a database”，先删除
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fs = require("fs");
      const isSqlite = (p: string) => {
        try {
          const fd = fs.openSync(p, "r");
          const buf = Buffer.alloc(16);
          fs.readSync(fd, buf, 0, 16, 0);
          fs.closeSync(fd);
          return buf.toString() === "SQLite format 3\0";
        } catch (_e) {
          return false;
        }
      };
      if (fs.existsSync(file)) {
        const stat = fs.statSync(file);
        // 简单判断：不是 sqlite 头，或明显是 json/小文件，则删除避免冲突
        if (!isSqlite(file) && (path.extname(file) === ".json" || stat.size < 1024)) {
          fs.unlinkSync(file);
        }
      }
    } catch (_e) {
      // ignore
    }
    this.db = new Database(file);
    this.bootstrap();
  }

  async init(): Promise<void> {
    return;
  }

  private bootstrap() {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS ${SQLiteTables.categories} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS ${SQLiteTables.documents} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        char_count INTEGER,
        FOREIGN KEY (category) REFERENCES ${SQLiteTables.categories}(id)
      );
      CREATE TABLE IF NOT EXISTS ${SQLiteTables.documentContent} (
        document_id INTEGER PRIMARY KEY,
        content TEXT NOT NULL,
        FOREIGN KEY (document_id) REFERENCES ${SQLiteTables.documents}(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS ${SQLiteTables.settings} (
        key TEXT PRIMARY KEY,
        value TEXT
      );
    `);
    // ensure default category
    const row = this.db.prepare(`SELECT id FROM ${SQLiteTables.categories} WHERE id = ?`).get(DEFAULT_CATEGORY_ID);
    if (!row) {
      const now = Date.now();
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.categories} (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
        )
        .run(DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME, now, now);
    }
  }

  async listCategories(): Promise<Category[]> {
    const rows = this.db
      .prepare(`SELECT id, name, created_at, updated_at FROM ${SQLiteTables.categories} ORDER BY created_at ASC`)
      .all();
    return rows.map((r) => mapSqlCategory(r as SQLiteCategoryRow));
  }

  async listCategoriesWithCount(): Promise<CategoryWithCount[]> {
    const rows = this.db
      .prepare(
        `SELECT c.id, c.name, c.created_at, c.updated_at, COUNT(d.id) as count
         FROM ${SQLiteTables.categories} c
         LEFT JOIN ${SQLiteTables.documents} d ON d.category = c.id
         GROUP BY c.id
         ORDER BY c.created_at ASC`,
      )
      .all();
    return rows.map((r) => ({...mapSqlCategory(r as SQLiteCategoryRow), count: Number(r.count)}));
  }

  async createCategory(name: string): Promise<Category> {
    const now = Date.now();
    const stmt = this.db.prepare(
      `INSERT INTO ${SQLiteTables.categories} (name, created_at, updated_at) VALUES (?, ?, ?)`,
    );
    const info = stmt.run(name, now, now);
    return {id: Number(info.lastInsertRowid), name, createdAt: now, updatedAt: now};
  }

  async renameCategory(id: number, name: string): Promise<void> {
    const now = Date.now();
    this.db
      .prepare(`UPDATE ${SQLiteTables.categories} SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name, now, id);
  }

  async deleteCategory(id: number, options?: {reassignTo?: number}): Promise<void> {
    if (id === DEFAULT_CATEGORY_ID) return;
    const target = options?.reassignTo ?? DEFAULT_CATEGORY_ID;
    const tx = this.db.transaction(() => {
      this.db.prepare(`UPDATE ${SQLiteTables.documents} SET category = ? WHERE category = ?`).run(target, id);
      this.db.prepare(`DELETE FROM ${SQLiteTables.categories} WHERE id = ?`).run(id);
    });
    tx();
  }

  async createDocument(meta: NewDocumentPayload, content: string): Promise<number> {
    const createdAt = toMillis(meta.createdAt ?? Date.now());
    const updatedAt = toMillis(meta.updatedAt ?? createdAt);
    const charCount = meta.charCount ?? content.length;
    const tx = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documents} (name, category, created_at, updated_at, char_count)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(meta.name, meta.category, createdAt, updatedAt, charCount);
      const id = Number(info.lastInsertRowid);
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documentContent} (document_id, content) VALUES (?, ?)
           ON CONFLICT(document_id) DO UPDATE SET content=excluded.content`,
        )
        .run(id, content);
      return id;
    });
    return tx();
  }

  async getDocumentMeta(documentId: number): Promise<DocumentMeta | null> {
    const row = this.db.prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE id = ?`).get(documentId);
    return row ? mapSqlDocToMeta(row as SQLiteDocumentRow) : null;
  }

  async updateDocumentMeta(documentId: number, updates: UpdateDocumentMetaInput): Promise<void> {
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      fields.push("category = ?");
      values.push(updates.category);
    }
    if (updates.charCount !== undefined) {
      fields.push("char_count = ?");
      values.push(updates.charCount);
    }
    const updatedAt = toMillis(updates.updatedAt ?? Date.now());
    fields.push("updated_at = ?");
    values.push(updatedAt);
    values.push(documentId);
    const sql = `UPDATE ${SQLiteTables.documents} SET ${fields.join(", ")} WHERE id = ?`;
    this.db.prepare(sql).run(...values);
  }

  async listDocumentsPage(
    offset: number,
    limit: number,
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    const items = this.db
      .prepare(
        `SELECT * FROM ${SQLiteTables.documents} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(limit, offset)
      .map((r) => mapSqlDocToMeta(r as SQLiteDocumentRow));
    const totalRow = this.db.prepare(`SELECT COUNT(*) as c FROM ${SQLiteTables.documents}`).get() as {c: number};
    const hasMore = totalRow.c > offset + items.length;
    return {items, hasMore};
  }

  async listAllDocuments(): Promise<DocumentMeta[]> {
    const rows = this.db.prepare(`SELECT * FROM ${SQLiteTables.documents} ORDER BY created_at DESC`).all();
    return rows.map((r) => mapSqlDocToMeta(r as SQLiteDocumentRow));
  }

  async ensureDocumentCharCount(meta: DocumentMeta): Promise<DocumentMeta> {
    if (meta.charCount != null) return meta;
    const content = await this.getDocumentContent(meta.document_id);
    const charCount = content.length;
    const next = {...meta, charCount};
    await this.updateDocumentMeta(meta.document_id, {charCount});
    return next;
  }

  async getDocumentContent(documentId: number): Promise<string> {
    const row = this.db
      .prepare(`SELECT content FROM ${SQLiteTables.documentContent} WHERE document_id = ?`)
      .get(documentId) as {content?: string} | undefined;
    return row?.content ?? "";
  }

  async deleteDocument(documentId: number): Promise<void> {
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM ${SQLiteTables.documentContent} WHERE document_id = ?`).run(documentId);
      this.db.prepare(`DELETE FROM ${SQLiteTables.documents} WHERE id = ?`).run(documentId);
    });
    tx();
  }

  async getConfig<T = unknown>(key: string, fallback?: T): Promise<T | null> {
    const row = this.db.prepare(`SELECT value FROM ${SQLiteTables.settings} WHERE key = ?`).get(key) as
      | {value?: string}
      | undefined;
    if (!row || row.value == null) return fallback ?? null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return (row.value as unknown) as T;
    }
  }

  async setConfig<T = unknown>(key: string, value: T): Promise<void> {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.settings} (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, payload);
  }

  async removeConfig(key: string): Promise<void> {
    this.db.prepare(`DELETE FROM ${SQLiteTables.settings} WHERE key = ?`).run(key);
  }

  async listConfigKeys(prefix?: string): Promise<string[]> {
    if (prefix) {
      const rows = this.db
        .prepare(`SELECT key FROM ${SQLiteTables.settings} WHERE key LIKE ?`)
        .all(`${prefix}%`) as {key: string}[];
      return rows.map((r) => r.key);
    }
    const rows = this.db.prepare(`SELECT key FROM ${SQLiteTables.settings}`).all() as {key: string}[];
    return rows.map((r) => r.key);
  }
}
