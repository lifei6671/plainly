import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";
import {
  Category,
  CategoryWithCount,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
  User,
  UserSession,
} from "../data/store/types";
import {IDataStore} from "../data/store/IDataStore";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../utils/constant";
import {
  DEFAULT_USER_ID,
  SQLiteTables,
  SQLiteDocumentRow,
  SQLiteCategoryRow,
  SQLiteUserRow,
  SQLiteSettingRow,
  SQLiteSessionRow,
  mapSqlDocToMeta,
  mapSqlCategory,
  SQLiteDDL,
} from "../data/store/schema";

type TimestampValue = Date | string | number;
type ColumnInfo = {name: string; pk: number; notnull: number; dflt_value: unknown};

const MIGRATION_USER_ID = 1;

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

const hashPassword = (password: string, salt?: string) => {
  const actualSalt = salt || crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, actualSalt, 10000, 64, "sha512").toString("hex");
  return {hash, salt: actualSalt};
};

export class NodeDataStore implements IDataStore {
  private db: Database.Database;
  private userId: number;
  private dbFile: string;

  constructor(dbFile = "data/plainly.db", userId = DEFAULT_USER_ID, sharedDb?: Database.Database) {
    this.userId = Number.isFinite(userId) ? Number(userId) : DEFAULT_USER_ID;
    this.dbFile = path.isAbsolute(dbFile) ? dbFile : path.resolve(process.cwd(), dbFile);
    const file = this.dbFile;
    if (!sharedDb) {
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
          if (!isSqlite(file) && (path.extname(file) === ".json" || stat.size < 1024)) {
            fs.unlinkSync(file);
          }
        }
      } catch (_e) {
        // ignore
      }
    }
    this.db = sharedDb ?? new Database(file);
    if (!sharedDb) {
      this.bootstrap();
    }
  }

  forUser(userId: number): NodeDataStore {
    if (!userId || userId <= 0) {
      throw new Error("userId is required for node datastore");
    }
    return new NodeDataStore(this.dbFile, userId, this.db);
  }

  async init(): Promise<void> {
    return;
  }

  private tableInfo(table: string): ColumnInfo[] {
    return this.db.prepare(`PRAGMA table_info(${table})`).all() as ColumnInfo[];
  }

  private ensureDefaultUser() {
    const row = this.db.prepare(`SELECT id FROM ${SQLiteTables.users} WHERE id = ?`).get(MIGRATION_USER_ID);
    if (!row) {
      const now = Date.now();
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.users} (id, account, password, registered_at, last_login_at, last_login_ip, status, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(MIGRATION_USER_ID, "local", "", now, now, "0.0.0.0", 1, now);
    }
  }

  private migrateCategories() {
    const info = this.tableInfo(SQLiteTables.categories);
    if (info.length === 0) {
      return;
    }
    const hasUserColumn = info.some((c) => c.name === "user_id");
    const pkColumns = info.filter((c) => c.pk > 0).map((c) => c.name);
    const hasCompositePk = pkColumns.includes("user_id") && pkColumns.includes("id");
    if (hasUserColumn && hasCompositePk) {
      return;
    }
    const tx = this.db.transaction(() => {
      this.db.exec(SQLiteDDL.categories.replace(SQLiteTables.categories, `${SQLiteTables.categories}_new`));
      this.db.exec(`
        INSERT OR IGNORE INTO ${SQLiteTables.categories}_new (user_id, id, name, created_at, updated_at)
        SELECT ${MIGRATION_USER_ID} as user_id, id, name, created_at, updated_at FROM ${SQLiteTables.categories};
      `);
      this.db.exec(`DROP TABLE ${SQLiteTables.categories};`);
      this.db.exec(`ALTER TABLE ${SQLiteTables.categories}_new RENAME TO ${SQLiteTables.categories};`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_user ON ${SQLiteTables.categories}(user_id);`);
    });
    tx();
  }

  private migrateUsers() {
    const info = this.tableInfo(SQLiteTables.users);
    if (info.length === 0) return;
    const hasTokenVersion = info.some((c) => c.name === "token_version");
    const hasPwdChanged = info.some((c) => c.name === "password_changed_at");
    if (!hasTokenVersion) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.users} ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;`);
    }
    if (!hasPwdChanged) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.users} ADD COLUMN password_changed_at INTEGER;`);
    }
  }

  private migrateDocuments() {
    const info = this.tableInfo(SQLiteTables.documents);
    if (info.length === 0) {
      return;
    }
    const hasUserColumn = info.some((c) => c.name === "user_id");
    if (hasUserColumn) {
      return;
    }
    const tx = this.db.transaction(() => {
      this.db.exec(SQLiteDDL.documents.replace(SQLiteTables.documents, `${SQLiteTables.documents}_new`));
      this.db.exec(`
        INSERT INTO ${SQLiteTables.documents}_new (id, user_id, name, category, created_at, updated_at, char_count)
        SELECT id, ${MIGRATION_USER_ID} as user_id, name, category, created_at, updated_at, char_count
        FROM ${SQLiteTables.documents};
      `);
      this.db.exec(`DROP TABLE ${SQLiteTables.documents};`);
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents}_new RENAME TO ${SQLiteTables.documents};`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_user ON ${SQLiteTables.documents}(user_id);`);
    });
    tx();
  }

  private migrateDocumentContent() {
    const info = this.tableInfo(SQLiteTables.documentContent);
    if (info.length === 0) {
      return;
    }
    const hasUserColumn = info.some((c) => c.name === "user_id");
    const pkColumns = info.filter((c) => c.pk > 0).map((c) => c.name);
    const hasCompositePk = pkColumns.includes("user_id") && pkColumns.includes("document_id");
    if (hasUserColumn && hasCompositePk) {
      return;
    }
    const tx = this.db.transaction(() => {
      this.db.exec(SQLiteDDL.documentContent.replace(SQLiteTables.documentContent, `${SQLiteTables.documentContent}_new`));
      this.db.exec(`
        INSERT INTO ${SQLiteTables.documentContent}_new (document_id, user_id, content)
        SELECT document_id, ${MIGRATION_USER_ID} as user_id, content FROM ${SQLiteTables.documentContent};
      `);
      this.db.exec(`DROP TABLE ${SQLiteTables.documentContent};`);
      this.db.exec(`ALTER TABLE ${SQLiteTables.documentContent}_new RENAME TO ${SQLiteTables.documentContent};`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_document_content_user ON ${SQLiteTables.documentContent}(user_id);`);
    });
    tx();
  }

  private migrateSettings() {
    const info = this.tableInfo(SQLiteTables.settings);
    if (info.length === 0) {
      return;
    }
    const hasUserColumn = info.some((c) => c.name === "user_id");
    const pkColumns = info.filter((c) => c.pk > 0).map((c) => c.name);
    const hasCompositePk = pkColumns.includes("user_id") && pkColumns.includes("key");
    if (hasUserColumn && hasCompositePk) {
      return;
    }
    const tx = this.db.transaction(() => {
      this.db.exec(SQLiteDDL.settings.replace(SQLiteTables.settings, `${SQLiteTables.settings}_new`));
      this.db.exec(`
        INSERT INTO ${SQLiteTables.settings}_new (user_id, key, value)
        SELECT ${MIGRATION_USER_ID} as user_id, key, value FROM ${SQLiteTables.settings};
      `);
      this.db.exec(`DROP TABLE ${SQLiteTables.settings};`);
      this.db.exec(`ALTER TABLE ${SQLiteTables.settings}_new RENAME TO ${SQLiteTables.settings};`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_settings_user ON ${SQLiteTables.settings}(user_id);`);
    });
    tx();
  }

  private bootstrap() {
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec(SQLiteDDL.users);
    this.migrateUsers();
    this.ensureDefaultUser();
    this.migrateCategories();
    this.migrateDocuments();
    this.migrateDocumentContent();
    this.migrateSettings();
    this.db.exec(
      [
        SQLiteDDL.users,
        SQLiteDDL.sessions,
        SQLiteDDL.categories,
        SQLiteDDL.documents,
        SQLiteDDL.documentContent,
        SQLiteDDL.settings,
      ].join("\n"),
    );
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_user ON ${SQLiteTables.documents}(user_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_categories_user ON ${SQLiteTables.categories}(user_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_document_content_user ON ${SQLiteTables.documentContent}(user_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_settings_user ON ${SQLiteTables.settings}(user_id);`);
    this.db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON ${SQLiteTables.sessions}(user_id);`);
  }

  private getUserRow(userId: number): SQLiteUserRow | null {
    return (
      (this.db.prepare(`SELECT * FROM ${SQLiteTables.users} WHERE id = ?`).get(userId) as SQLiteUserRow | undefined) ||
      null
    );
  }

  private ensureUserExists() {
    if (!this.userId || this.userId <= 0) {
      throw new Error("User not logged in");
    }
    const row = this.getUserRow(this.userId);
    if (!row) {
      throw new Error(`User ${this.userId} not found`);
    }
    if (row.status === 0) {
      throw new Error("User is disabled");
    }
  }

  private ensureDefaultCategory() {
    if (!this.userId || this.userId <= 0) return;
    const row = this.db
      .prepare(`SELECT id FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`)
      .get(this.userId, DEFAULT_CATEGORY_ID);
    if (!row) {
      const now = Date.now();
      this.db
        .prepare(
          `INSERT OR IGNORE INTO ${SQLiteTables.categories} (user_id, id, name, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(this.userId, DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME, now, now);
    }
  }

  private nextCategoryId(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(id), 0) as maxId FROM ${SQLiteTables.categories} WHERE user_id = ?`)
      .get(this.userId) as {maxId?: number};
    return Number(row?.maxId ?? 0) + 1;
  }

  private mapUser(row: SQLiteUserRow): User {
    return {
      id: row.id,
      account: row.account,
      registeredAt: row.registered_at,
      lastLoginAt: row.last_login_at,
      lastLoginIp: row.last_login_ip,
      status: row.status ?? undefined,
      passwordChangedAt: row.password_changed_at ?? null,
      tokenVersion: row.token_version ?? 1,
    };
  }

  // ---------- Auth helpers ----------
  createUser(account: string, password: string): User {
    const exists = this.db.prepare(`SELECT id FROM ${SQLiteTables.users} WHERE account = ?`).get(account);
    if (exists) {
      throw new Error("account already exists");
    }
    const now = Date.now();
    const {hash, salt} = hashPassword(password);
    const info = this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.users} (account, password, password_salt, registered_at, updated_at, status, token_version, password_changed_at)
         VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
      )
      .run(account, hash, salt, now, now, now);
    const id = Number(info.lastInsertRowid);
    return {
      id,
      account,
      registeredAt: now,
      lastLoginAt: null,
      lastLoginIp: null,
      status: 1,
      tokenVersion: 1,
      passwordChangedAt: now,
    };
  }

  findUserByAccount(account: string): User | null {
    const row = this.db.prepare(`SELECT * FROM ${SQLiteTables.users} WHERE account = ?`).get(account) as
      | SQLiteUserRow
      | undefined;
    return row ? this.mapUser(row) : null;
  }

  verifyUser(account: string, password: string): User | null {
    const row = this.db.prepare(`SELECT * FROM ${SQLiteTables.users} WHERE account = ?`).get(account) as
      | SQLiteUserRow
      | undefined;
    if (!row) return null;
    if (row.status === 0) return null;
    const {hash} = hashPassword(password, row.password_salt || undefined);
    if (hash !== row.password) return null;
    this.touchLogin(row.id);
    return this.mapUser(row);
  }

  getUser(userId: number): User | null {
    const row = this.getUserRow(userId);
    if (!row || row.status === 0) return null;
    return this.mapUser(row);
  }

  updatePassword(userId: number, newPassword: string, oldPassword?: string): void {
    const row = this.db.prepare(`SELECT * FROM ${SQLiteTables.users} WHERE id = ?`).get(userId) as
      | SQLiteUserRow
      | undefined;
    if (!row) throw new Error("user not found");
    if (oldPassword) {
      const {hash} = hashPassword(oldPassword, row.password_salt || undefined);
      if (hash !== row.password) throw new Error("old password not match");
    }
    const {hash, salt} = hashPassword(newPassword);
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE ${SQLiteTables.users}
         SET password = ?, password_salt = ?, password_changed_at = ?, token_version = COALESCE(token_version, 1) + 1, updated_at = ?
         WHERE id = ?`,
      )
      .run(hash, salt, now, now, userId);
    this.revokeUserSessions(userId);
  }

  touchLogin(userId: number, ip?: string) {
    const now = Date.now();
    this.db
      .prepare(`UPDATE ${SQLiteTables.users} SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE id = ?`)
      .run(now, ip || null, now, userId);
  }

  // ---------- Session helpers ----------
  private hashRefreshToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  private cleanupExpiredSessions() {
    const now = Date.now();
    this.db.prepare(`DELETE FROM ${SQLiteTables.sessions} WHERE expires_at < ?`).run(now);
  }

  createSession(userId: number, refreshToken: string, expiresAt: number, meta?: Partial<UserSession>): UserSession {
    this.cleanupExpiredSessions();
    const now = Date.now();
    const id = meta?.id || crypto.randomUUID();
    const deviceId = meta?.deviceId ?? null;
    const ip = meta?.ip ?? null;
    const ua = meta?.ua ?? null;
    const hash = this.hashRefreshToken(refreshToken);
    this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.sessions}
         (id, user_id, device_id, refresh_token_hash, created_at, expires_at, last_seen_at, ip, ua)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, userId, deviceId, hash, now, expiresAt, now, ip, ua);
    return {
      id,
      userId,
      deviceId,
      refreshTokenHash: hash,
      createdAt: now,
      expiresAt,
      revokedAt: null,
      lastSeenAt: now,
      ip,
      ua,
    };
  }

  getSession(sessionId: string): UserSession | null {
    const row = this.db.prepare(`SELECT * FROM ${SQLiteTables.sessions} WHERE id = ?`).get(sessionId) as
      | SQLiteSessionRow
      | undefined;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      deviceId: row.device_id ?? null,
      refreshTokenHash: row.refresh_token_hash,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at ?? null,
      lastSeenAt: row.last_seen_at ?? null,
      ip: row.ip ?? null,
      ua: row.ua ?? null,
    };
  }

  rotateSession(sessionId: string, nextRefreshToken: string, nextExpiresAt: number): void {
    const hash = this.hashRefreshToken(nextRefreshToken);
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE ${SQLiteTables.sessions}
         SET refresh_token_hash = ?, expires_at = ?, last_seen_at = ?
         WHERE id = ?`,
      )
      .run(hash, nextExpiresAt, now, sessionId);
  }

  validateRefreshToken(sessionId: string, token: string): UserSession | null {
    this.cleanupExpiredSessions();
    const session = this.getSession(sessionId);
    if (!session) return null;
    if (session.revokedAt) return null;
    const expires = toMillis(session.expiresAt);
    if (expires < Date.now()) return null;
    const incomingHash = this.hashRefreshToken(token);
    if (incomingHash !== session.refreshTokenHash) return null;
    return session;
  }

  revokeSession(sessionId: string): void {
    const now = Date.now();
    this.db
      .prepare(`UPDATE ${SQLiteTables.sessions} SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`)
      .run(now, sessionId);
  }

  revokeUserSessions(userId: number): void {
    const now = Date.now();
    this.db
      .prepare(`UPDATE ${SQLiteTables.sessions} SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`)
      .run(now, userId);
    this.db
      .prepare(
        `UPDATE ${SQLiteTables.users} SET token_version = COALESCE(token_version, 1) + 1, updated_at = ? WHERE id = ?`,
      )
      .run(now, userId);
  }

  // ---------- IDataStore implementation ----------

  async listCategories(): Promise<Category[]> {
    this.ensureUserExists();
    this.ensureDefaultCategory();
    const rows = this.db
      .prepare(
        `SELECT id, name, created_at, updated_at, user_id FROM ${SQLiteTables.categories}
         WHERE user_id = ?
         ORDER BY created_at ASC`,
      )
      .all(this.userId);
    return rows.map((r) => mapSqlCategory(r as SQLiteCategoryRow));
  }

  async listCategoriesWithCount(): Promise<CategoryWithCount[]> {
    this.ensureUserExists();
    this.ensureDefaultCategory();
    const rows = this.db
      .prepare(
        `SELECT c.id, c.name, c.created_at, c.updated_at, c.user_id, COUNT(d.id) as count
         FROM ${SQLiteTables.categories} c
         LEFT JOIN ${SQLiteTables.documents} d
           ON d.category = c.id AND d.user_id = c.user_id
         WHERE c.user_id = ?
         GROUP BY c.id, c.user_id
         ORDER BY c.created_at ASC`,
      )
      .all(this.userId);
    return rows.map((r) => ({...mapSqlCategory(r as SQLiteCategoryRow), count: Number(r.count)}));
  }

  async createCategory(name: string): Promise<Category> {
    this.ensureUserExists();
    const now = Date.now();
    const id = this.nextCategoryId();
    this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.categories} (user_id, id, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(this.userId, id, name, now, now);
    return {id, name, createdAt: now, updatedAt: now, uid: this.userId};
  }

  async renameCategory(id: number, name: string): Promise<void> {
    this.ensureUserExists();
    const now = Date.now();
    this.db
      .prepare(
        `UPDATE ${SQLiteTables.categories}
         SET name = ?, updated_at = ?
         WHERE user_id = ? AND id = ?`,
      )
      .run(name, now, this.userId, id);
  }

  async deleteCategory(id: number, options?: {reassignTo?: number}): Promise<void> {
    this.ensureUserExists();
    if (id === DEFAULT_CATEGORY_ID) return;
    const target = options?.reassignTo ?? DEFAULT_CATEGORY_ID;
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE ${SQLiteTables.documents}
           SET category = ?
           WHERE user_id = ? AND category = ?`,
        )
        .run(target, this.userId, id);
      this.db.prepare(`DELETE FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`).run(this.userId, id);
    });
    tx();
  }

  async createDocument(meta: NewDocumentPayload, content: string): Promise<number> {
    this.ensureUserExists();
    this.ensureDefaultCategory();
    const createdAt = toMillis(meta.createdAt ?? Date.now());
    const updatedAt = toMillis(meta.updatedAt ?? createdAt);
    const charCount = meta.charCount ?? content.length;
    let categoryId = meta.category ?? DEFAULT_CATEGORY_ID;
    const categoryExists = this.db
      .prepare(`SELECT 1 FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`)
      .get(this.userId, categoryId);
    if (!categoryExists) {
      categoryId = DEFAULT_CATEGORY_ID;
    }
    const tx = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documents} (user_id, name, category, created_at, updated_at, char_count)
           VALUES (?, ?, ?, ?, ?, ?)`,
        )
        .run(this.userId, meta.name, categoryId, createdAt, updatedAt, charCount);
      const id = Number(info.lastInsertRowid);
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documentContent} (document_id, user_id, content) VALUES (?, ?, ?)
           ON CONFLICT(document_id, user_id) DO UPDATE SET content=excluded.content`,
        )
        .run(id, this.userId, content);
      return id;
    });
    return tx();
  }

  async getDocumentMeta(documentId: number): Promise<DocumentMeta | null> {
    this.ensureUserExists();
    const row = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE id = ? AND user_id = ?`)
      .get(documentId, this.userId);
    return row ? mapSqlDocToMeta(row as SQLiteDocumentRow) : null;
  }

  async updateDocumentMeta(documentId: number, updates: UpdateDocumentMetaInput): Promise<void> {
    this.ensureUserExists();
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.category !== undefined) {
      const categoryRow = this.db
        .prepare(`SELECT 1 FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`)
        .get(this.userId, updates.category);
      const nextCategory = categoryRow ? updates.category : DEFAULT_CATEGORY_ID;
      fields.push("category = ?");
      values.push(nextCategory);
    }
    if (updates.charCount !== undefined) {
      fields.push("char_count = ?");
      values.push(updates.charCount);
    }
    const updatedAt = toMillis(updates.updatedAt ?? Date.now());
    fields.push("updated_at = ?");
    values.push(updatedAt);
    values.push(this.userId, documentId);
    const sql = `UPDATE ${SQLiteTables.documents} SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`;
    this.db.prepare(sql).run(...values);
  }

  async listDocumentsPage(
    offset: number,
    limit: number,
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    this.ensureUserExists();
    const items = this.db
      .prepare(
        `SELECT * FROM ${SQLiteTables.documents}
         WHERE user_id = ?
         ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      )
      .all(this.userId, limit, offset)
      .map((r) => mapSqlDocToMeta(r as SQLiteDocumentRow));
    const totalRow = this.db
      .prepare(`SELECT COUNT(*) as c FROM ${SQLiteTables.documents} WHERE user_id = ?`)
      .get(this.userId) as {c: number};
    const hasMore = totalRow.c > offset + items.length;
    return {items, hasMore};
  }

  async listAllDocuments(): Promise<DocumentMeta[]> {
    this.ensureUserExists();
    const rows = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE user_id = ? ORDER BY created_at DESC`)
      .all(this.userId);
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
    this.ensureUserExists();
    const row = this.db
      .prepare(`SELECT content FROM ${SQLiteTables.documentContent} WHERE document_id = ? AND user_id = ?`)
      .get(documentId, this.userId) as {content?: string} | undefined;
    return row?.content ?? "";
  }

  async deleteDocument(documentId: number): Promise<void> {
    this.ensureUserExists();
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`DELETE FROM ${SQLiteTables.documentContent} WHERE document_id = ? AND user_id = ?`)
        .run(documentId, this.userId);
      this.db.prepare(`DELETE FROM ${SQLiteTables.documents} WHERE id = ? AND user_id = ?`).run(documentId, this.userId);
    });
    tx();
  }

  async getConfig<T = unknown>(key: string, fallback?: T): Promise<T | null> {
    this.ensureUserExists();
    const row = this.db
      .prepare(`SELECT value FROM ${SQLiteTables.settings} WHERE key = ? AND user_id = ?`)
      .get(key, this.userId) as SQLiteSettingRow | undefined;
    if (!row || row.value == null) return fallback ?? null;
    try {
      return JSON.parse(row.value) as T;
    } catch {
      return (row.value as unknown) as T;
    }
  }

  async setConfig<T = unknown>(key: string, value: T): Promise<void> {
    this.ensureUserExists();
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.settings} (user_id, key, value) VALUES (?, ?, ?)
         ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
      )
      .run(this.userId, key, payload);
  }

  async removeConfig(key: string): Promise<void> {
    this.ensureUserExists();
    this.db.prepare(`DELETE FROM ${SQLiteTables.settings} WHERE key = ? AND user_id = ?`).run(key, this.userId);
  }

  async listConfigKeys(prefix?: string): Promise<string[]> {
    this.ensureUserExists();
    if (prefix) {
      const rows = this.db
        .prepare(`SELECT key FROM ${SQLiteTables.settings} WHERE user_id = ? AND key LIKE ?`)
        .all(this.userId, `${prefix}%`) as {key: string}[];
      return rows.map((r) => r.key);
    }
    const rows = this.db
      .prepare(`SELECT key FROM ${SQLiteTables.settings} WHERE user_id = ?`)
      .all(this.userId) as {key: string}[];
    return rows.map((r) => r.key);
  }
}
