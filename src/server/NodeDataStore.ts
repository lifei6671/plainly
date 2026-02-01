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
import {DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_ID} from "../utils/constant";
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

const generateUuid = () => {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const buf = crypto.randomBytes(16);
  // RFC4122 v4
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  return buf.toString("hex");
};

const normalizeUuid = (value?: string | null): string => {
  if (!value) return "";
  return String(value).trim().replace(/-/g, "");
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
      const rows = this.db
        .prepare(`SELECT id, name, created_at, updated_at FROM ${SQLiteTables.categories}`)
        .all() as {id: number; name: string; created_at: number; updated_at: number}[];
      const insert = this.db.prepare(
        `INSERT OR IGNORE INTO ${SQLiteTables.categories}_new
         (user_id, id, category_id, name, created_at, updated_at, source, version)
         VALUES (?, ?, ?, ?, ?, ?, 'remote', 1)`,
      );
      rows.forEach((row) => {
        const categoryUuid = row.id === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_UUID : generateUuid();
        insert.run(MIGRATION_USER_ID, row.id, categoryUuid, row.name, row.created_at, row.updated_at);
      });
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
      const categoryRows = this.db
        .prepare(`SELECT id, category_id FROM ${SQLiteTables.categories}`)
        .all() as {id: number; category_id: string}[];
      const categoryMap = new Map<number, string>();
      categoryRows.forEach((row) => {
        if (row && row.id != null && row.category_id) {
          categoryMap.set(row.id, row.category_id);
        }
      });
      const rows = this.db
        .prepare(`SELECT id, name, category, created_at, updated_at, char_count FROM ${SQLiteTables.documents}`)
        .all() as {
        id: number;
        name: string;
        category: number;
        created_at: number;
        updated_at: number;
        char_count?: number | null;
      }[];
      const insert = this.db.prepare(
        `INSERT INTO ${SQLiteTables.documents}_new
         (id, user_id, document_id, name, category, category_id, created_at, updated_at, char_count, source, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'remote', 1)`,
      );
      rows.forEach((row) => {
        const categoryId = Number(row.category ?? DEFAULT_CATEGORY_ID);
        const normalizedCategoryId = Number.isFinite(categoryId) ? categoryId : DEFAULT_CATEGORY_ID;
        const categoryUuid = categoryMap.get(normalizedCategoryId) || DEFAULT_CATEGORY_UUID;
        insert.run(
          row.id,
          MIGRATION_USER_ID,
          generateUuid(),
          row.name,
          normalizedCategoryId,
          categoryUuid,
          row.created_at,
          row.updated_at,
          row.char_count ?? null,
        );
      });
      this.db.exec(`DROP TABLE ${SQLiteTables.documents};`);
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents}_new RENAME TO ${SQLiteTables.documents};`);
      this.db.exec(`CREATE INDEX IF NOT EXISTS idx_documents_user ON ${SQLiteTables.documents}(user_id);`);
    });
    tx();
  }

  private migrateCategoryIds() {
    let info = this.tableInfo(SQLiteTables.categories);
    if (info.length === 0) return;
    const hasCategoryId = info.some((c) => c.name === "category_id");
    const hasLegacyUuid = info.some((c) => c.name === "category_uuid");
    if (!hasCategoryId && hasLegacyUuid) {
      try {
        this.db.exec(`ALTER TABLE ${SQLiteTables.categories} RENAME COLUMN category_uuid TO category_id;`);
      } catch (_e) {
        // ignore
      }
    }
    info = this.tableInfo(SQLiteTables.categories);
    const hasCategoryIdNow = info.some((c) => c.name === "category_id");
    if (!hasCategoryIdNow) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.categories} ADD COLUMN category_id TEXT;`);
    }
    const hasSource = info.some((c) => c.name === "source");
    const hasVersion = info.some((c) => c.name === "version");
    if (!hasSource) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.categories} ADD COLUMN source TEXT NOT NULL DEFAULT 'remote';`);
    }
    if (!hasVersion) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.categories} ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
    }
    const rows = this.db
      .prepare(`SELECT id, user_id, category_id FROM ${SQLiteTables.categories}`)
      .all() as {id: number; user_id: number; category_id?: string | null}[];
    const update = this.db.prepare(
      `UPDATE ${SQLiteTables.categories} SET category_id = ?, source = COALESCE(source, 'remote'), version = COALESCE(version, 1) WHERE user_id = ? AND id = ?`,
    );
    rows.forEach((row) => {
      const current = normalizeUuid(row.category_id || "");
      if (!current) {
        const nextUuid = row.id === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_UUID : generateUuid();
        update.run(nextUuid, row.user_id, row.id);
      } else if (row.category_id !== current) {
        update.run(current, row.user_id, row.id);
      }
    });
    this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_user_id ON ${SQLiteTables.categories}(user_id, category_id);`,
    );
  }

  private migrateDocumentIds() {
    let info = this.tableInfo(SQLiteTables.documents);
    if (info.length === 0) return;
    const hasDocumentId = info.some((c) => c.name === "document_id");
    const hasLegacyDocUuid = info.some((c) => c.name === "document_uuid");
    if (!hasDocumentId && hasLegacyDocUuid) {
      try {
        this.db.exec(`ALTER TABLE ${SQLiteTables.documents} RENAME COLUMN document_uuid TO document_id;`);
      } catch (_e) {
        // ignore
      }
    }
    info = this.tableInfo(SQLiteTables.documents);
    const hasDocumentIdNow = info.some((c) => c.name === "document_id");
    if (!hasDocumentIdNow) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents} ADD COLUMN document_id TEXT;`);
    }
    const hasCategoryId = info.some((c) => c.name === "category_id");
    const hasLegacyCatUuid = info.some((c) => c.name === "category_uuid");
    if (!hasCategoryId && hasLegacyCatUuid) {
      try {
        this.db.exec(`ALTER TABLE ${SQLiteTables.documents} RENAME COLUMN category_uuid TO category_id;`);
      } catch (_e) {
        // ignore
      }
    }
    info = this.tableInfo(SQLiteTables.documents);
    const hasCategoryIdNow = info.some((c) => c.name === "category_id");
    if (!hasCategoryIdNow) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents} ADD COLUMN category_id TEXT;`);
    }
    const hasSource = info.some((c) => c.name === "source");
    const hasVersion = info.some((c) => c.name === "version");
    if (!hasSource) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents} ADD COLUMN source TEXT NOT NULL DEFAULT 'remote';`);
    }
    if (!hasVersion) {
      this.db.exec(`ALTER TABLE ${SQLiteTables.documents} ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
    }
    const rows = this.db
      .prepare(
        `SELECT d.id, d.user_id, d.document_id, d.category, d.category_id, c.category_id AS cat_uuid
         FROM ${SQLiteTables.documents} d
         LEFT JOIN ${SQLiteTables.categories} c
           ON c.user_id = d.user_id AND c.id = d.category`,
      )
      .all() as {
      id: number;
      user_id: number;
      document_id?: string | null;
      category?: number | null;
      category_id?: string | null;
      cat_uuid?: string | null;
    }[];
    const update = this.db.prepare(
      `UPDATE ${SQLiteTables.documents}
       SET document_id = ?, category_id = ?, source = COALESCE(source, 'remote'), version = COALESCE(version, 1)
       WHERE user_id = ? AND id = ?`,
    );
    rows.forEach((row) => {
      const docId = normalizeUuid(row.document_id || "") || generateUuid();
      const catId =
        normalizeUuid(row.category_id || "") ||
        normalizeUuid(row.cat_uuid || "") ||
        DEFAULT_CATEGORY_UUID;
      update.run(docId, catId, row.user_id, row.id);
    });
    this.db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_user_id ON ${SQLiteTables.documents}(user_id, document_id);`,
    );
  }

  private migrateDocumentContent() {
    let info = this.tableInfo(SQLiteTables.documentContent);
    if (info.length === 0) {
      return;
    }
    const hasRowId = info.some((c) => c.name === "document_row_id");
    const hasDocId = info.some((c) => c.name === "document_id");
    if (!hasRowId && hasDocId) {
      try {
        this.db.exec(`ALTER TABLE ${SQLiteTables.documentContent} RENAME COLUMN document_id TO document_row_id;`);
      } catch (_e) {
        // ignore
      }
    }
    info = this.tableInfo(SQLiteTables.documentContent);
    const hasUserColumn = info.some((c) => c.name === "user_id");
    const pkColumns = info.filter((c) => c.pk > 0).map((c) => c.name);
    const hasCompositePk = pkColumns.includes("user_id") && pkColumns.includes("document_row_id");
    if (hasUserColumn && hasCompositePk) {
      return;
    }
    const sourceColumn = info.some((c) => c.name === "document_row_id") ? "document_row_id" : "document_id";
    const tx = this.db.transaction(() => {
      this.db.exec(SQLiteDDL.documentContent.replace(SQLiteTables.documentContent, `${SQLiteTables.documentContent}_new`));
      this.db.exec(`
        INSERT INTO ${SQLiteTables.documentContent}_new (document_row_id, user_id, content)
        SELECT ${sourceColumn}, ${hasUserColumn ? "user_id" : MIGRATION_USER_ID} as user_id, content FROM ${SQLiteTables.documentContent};
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
    this.migrateCategoryIds();
    this.migrateDocumentIds();
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
      .prepare(
        `SELECT id, category_id FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`,
      )
      .get(this.userId, DEFAULT_CATEGORY_ID) as {id: number; category_id?: string | null} | undefined;
    const now = Date.now();
    if (!row) {
      this.db
        .prepare(
          `INSERT OR IGNORE INTO ${SQLiteTables.categories}
           (user_id, id, category_id, name, created_at, updated_at, source, version)
           VALUES (?, ?, ?, ?, ?, ?, 'remote', 1)`,
        )
        .run(this.userId, DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME, now, now);
      return;
    }
    const normalized = normalizeUuid(row.category_id || "");
    if (!normalized || normalized !== row.category_id) {
      this.db
        .prepare(
          `UPDATE ${SQLiteTables.categories}
           SET category_id = ?, updated_at = ?, source = COALESCE(source, 'remote'), version = COALESCE(version, 1)
           WHERE user_id = ? AND id = ?`,
        )
        .run(DEFAULT_CATEGORY_UUID, now, this.userId, DEFAULT_CATEGORY_ID);
    }
  }

  private nextCategoryId(): number {
    const row = this.db
      .prepare(`SELECT COALESCE(MAX(id), 0) as maxId FROM ${SQLiteTables.categories} WHERE user_id = ?`)
      .get(this.userId) as {maxId?: number};
    return Number(row?.maxId ?? 0) + 1;
  }

  private isNumericKey(value: string): boolean {
    return /^\d+$/.test(value) && value.length <= 12;
  }

  private getCategoryRowByUuid(categoryUuid: string): SQLiteCategoryRow | null {
    const normalized = normalizeUuid(categoryUuid);
    const row = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.categories} WHERE user_id = ? AND category_id = ?`)
      .get(this.userId, normalized || categoryUuid) as SQLiteCategoryRow | undefined;
    if (row) return row;
    const candidate = normalized || categoryUuid;
    if (this.isNumericKey(candidate)) {
      const id = Number(candidate);
      const byId = this.db
        .prepare(`SELECT * FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`)
        .get(this.userId, id) as SQLiteCategoryRow | undefined;
      return byId || null;
    }
    return null;
  }

  private getDocumentRowByUuid(documentUuid: string): SQLiteDocumentRow | null {
    const normalized = normalizeUuid(documentUuid);
    const row = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE user_id = ? AND document_id = ?`)
      .get(this.userId, normalized || documentUuid) as SQLiteDocumentRow | undefined;
    if (row) return row;
    const candidate = normalized || documentUuid;
    if (this.isNumericKey(candidate)) {
      const id = Number(candidate);
      const byId = this.db
        .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE user_id = ? AND id = ?`)
        .get(this.userId, id) as SQLiteDocumentRow | undefined;
      return byId || null;
    }
    return null;
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
        `SELECT id, category_id, name, created_at, updated_at, source, version, user_id FROM ${SQLiteTables.categories}
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
        `SELECT c.id, c.category_id, c.name, c.created_at, c.updated_at, c.source, c.version, c.user_id, COUNT(d.id) as count
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

  async createCategory(
    name: string,
    options?: {category_id?: string; source?: "local" | "remote"; version?: number},
  ): Promise<Category> {
    this.ensureUserExists();
    const trimmed = String(name || "").trim();
    if (!trimmed) {
      throw new Error("category name required");
    }
    const existingByName = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.categories} WHERE user_id = ? AND name = ?`)
      .get(this.userId, trimmed) as SQLiteCategoryRow | undefined;
    if (existingByName) {
      return mapSqlCategory(existingByName);
    }
    const now = Date.now();
    const id = this.nextCategoryId();
    let categoryUuid = normalizeUuid(options?.category_id ? String(options.category_id).trim() : "");
    if (!categoryUuid) {
      categoryUuid = generateUuid();
    }
    const existingByUuid = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.categories} WHERE user_id = ? AND category_id = ?`)
      .get(this.userId, categoryUuid) as SQLiteCategoryRow | undefined;
    if (existingByUuid) {
      categoryUuid = generateUuid();
    }
    const source = options?.source || "remote";
    const version = options?.version ?? 1;
    this.db
      .prepare(
        `INSERT INTO ${SQLiteTables.categories} (user_id, id, category_id, name, created_at, updated_at, source, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(this.userId, id, categoryUuid, trimmed, now, now, source, version);
    return {
      id,
      category_id: categoryUuid,
      name: trimmed,
      createdAt: now,
      updatedAt: now,
      source,
      version,
      uid: this.userId,
    };
  }

  async renameCategory(categoryUuid: string, name: string): Promise<void> {
    this.ensureUserExists();
    const now = Date.now();
    const row = this.getCategoryRowByUuid(categoryUuid);
    if (!row) return;
    this.db
      .prepare(
        `UPDATE ${SQLiteTables.categories}
         SET name = ?, updated_at = ?, version = COALESCE(version, 1) + 1
         WHERE user_id = ? AND id = ?`,
      )
      .run(name, now, this.userId, row.id);
  }

  async deleteCategory(categoryUuid: string, options?: {reassignTo?: string}): Promise<void> {
    this.ensureUserExists();
    const targetUuid = options?.reassignTo || DEFAULT_CATEGORY_UUID;
    const row = this.getCategoryRowByUuid(categoryUuid);
    if (!row) return;
    if (row.category_id === DEFAULT_CATEGORY_UUID || row.id === DEFAULT_CATEGORY_ID) return;
    const targetRow = this.getCategoryRowByUuid(targetUuid);
    const targetId = targetRow ? targetRow.id : DEFAULT_CATEGORY_ID;
    const targetCategoryUuid = targetRow ? targetRow.category_id : DEFAULT_CATEGORY_UUID;
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE ${SQLiteTables.documents}
           SET category = ?, category_id = ?
           WHERE user_id = ? AND category = ?`,
        )
        .run(targetId, targetCategoryUuid, this.userId, row.id);
      this.db
        .prepare(`DELETE FROM ${SQLiteTables.categories} WHERE user_id = ? AND id = ?`)
        .run(this.userId, row.id);
    });
    tx();
  }

  async createDocument(meta: NewDocumentPayload, content: string): Promise<DocumentMeta> {
    this.ensureUserExists();
    this.ensureDefaultCategory();
    const createdAt = toMillis(meta.createdAt ?? Date.now());
    const updatedAt = toMillis(meta.updatedAt ?? createdAt);
    const charCount = meta.charCount ?? content.length;
    const incomingCategoryUuid = normalizeUuid(meta.category_id ? String(meta.category_id) : "") || DEFAULT_CATEGORY_UUID;
    const categoryRow =
      this.getCategoryRowByUuid(incomingCategoryUuid) || this.getCategoryRowByUuid(DEFAULT_CATEGORY_UUID);
    const categoryId = categoryRow ? categoryRow.id : DEFAULT_CATEGORY_ID;
    const categoryUuid = categoryRow ? categoryRow.category_id : DEFAULT_CATEGORY_UUID;
    let documentUuid = normalizeUuid(meta.document_id ? String(meta.document_id).trim() : "");
    if (!documentUuid) {
      documentUuid = generateUuid();
    }
    const source = meta.source || "remote";
    const version = meta.version ?? 1;
    const existing = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE user_id = ? AND document_id = ?`)
      .get(this.userId, documentUuid) as SQLiteDocumentRow | undefined;
    if (existing) {
      const existingVersion = Number(existing.version ?? 1);
      if (version > existingVersion) {
        const tx = this.db.transaction(() => {
          this.db
            .prepare(
              `UPDATE ${SQLiteTables.documents}
               SET name = ?, category = ?, category_id = ?, updated_at = ?, char_count = ?, source = ?, version = ?
               WHERE user_id = ? AND id = ?`,
            )
            .run(
              meta.name,
              categoryId,
              categoryUuid,
              updatedAt,
              charCount,
              source,
              version,
              this.userId,
              existing.id,
            );
          this.db
            .prepare(
              `INSERT INTO ${SQLiteTables.documentContent} (document_row_id, user_id, content) VALUES (?, ?, ?)
               ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
            )
            .run(existing.id, this.userId, content);
        });
        tx();
      }
      const row = this.getDocumentRowByUuid(documentUuid);
      return row ? mapSqlDocToMeta(row) : mapSqlDocToMeta(existing);
    }
    const tx = this.db.transaction(() => {
      const info = this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documents}
           (user_id, document_id, name, category, category_id, created_at, updated_at, char_count, source, version)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(this.userId, documentUuid, meta.name, categoryId, categoryUuid, createdAt, updatedAt, charCount, source, version);
      const id = Number(info.lastInsertRowid);
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documentContent} (document_row_id, user_id, content) VALUES (?, ?, ?)
           ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
        )
        .run(id, this.userId, content);
      return id;
    });
    const id = tx();
    const row = this.db
      .prepare(`SELECT * FROM ${SQLiteTables.documents} WHERE id = ? AND user_id = ?`)
      .get(id, this.userId) as SQLiteDocumentRow | undefined;
    return row
      ? mapSqlDocToMeta(row)
      : {
          id,
          document_id: documentUuid,
          name: meta.name,
          category_id: categoryUuid,
          createdAt,
          updatedAt,
          charCount,
          source,
          version,
          uid: this.userId,
        };
  }

  async getDocumentMeta(documentUuid: string): Promise<DocumentMeta | null> {
    this.ensureUserExists();
    const row = this.getDocumentRowByUuid(documentUuid);
    return row ? mapSqlDocToMeta(row) : null;
  }

  async updateDocumentMeta(documentUuid: string, updates: UpdateDocumentMetaInput): Promise<void> {
    this.ensureUserExists();
    const current = this.getDocumentRowByUuid(documentUuid);
    if (!current) return;
    const fields: string[] = [];
    const values: any[] = [];
    if (updates.name !== undefined) {
      fields.push("name = ?");
      values.push(updates.name);
    }
    if (updates.category_id !== undefined) {
      const normalizedCategory = normalizeUuid(String(updates.category_id));
      const categoryRow = this.getCategoryRowByUuid(normalizedCategory || String(updates.category_id));
      const nextCategoryId = categoryRow ? categoryRow.id : DEFAULT_CATEGORY_ID;
      const nextCategoryUuid = categoryRow ? categoryRow.category_id : DEFAULT_CATEGORY_UUID;
      fields.push("category = ?");
      values.push(nextCategoryId);
      fields.push("category_id = ?");
      values.push(nextCategoryUuid);
    }
    if (updates.charCount !== undefined) {
      fields.push("char_count = ?");
      values.push(updates.charCount);
    }
    if (updates.source !== undefined) {
      fields.push("source = ?");
      values.push(updates.source);
    }
    const updatedAt = toMillis(updates.updatedAt ?? Date.now());
    fields.push("updated_at = ?");
    values.push(updatedAt);
    if (updates.version !== undefined) {
      fields.push("version = ?");
      values.push(updates.version);
    } else {
      fields.push("version = COALESCE(version, 1) + 1");
    }
    values.push(this.userId, current.id);
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

  async getDocumentContent(documentUuid: string): Promise<string> {
    this.ensureUserExists();
    const current = this.getDocumentRowByUuid(documentUuid);
    if (!current) return "";
    const row = this.db
      .prepare(`SELECT content FROM ${SQLiteTables.documentContent} WHERE document_row_id = ? AND user_id = ?`)
      .get(current.id, this.userId) as {content?: string} | undefined;
    return row?.content ?? "";
  }

  async saveDocumentContent(documentUuid: string, content: string, updatedAt?: TimestampValue): Promise<void> {
    this.ensureUserExists();
    const current = this.getDocumentRowByUuid(documentUuid);
    if (!current) return;
    const nextUpdatedAt = toMillis(updatedAt ?? Date.now());
    const charCount = content.length;
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO ${SQLiteTables.documentContent} (document_row_id, user_id, content)
           VALUES (?, ?, ?)
           ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
        )
        .run(current.id, this.userId, content);
      this.db
        .prepare(
          `UPDATE ${SQLiteTables.documents}
           SET updated_at = ?, char_count = ?, version = COALESCE(version, 1) + 1
           WHERE id = ? AND user_id = ?`,
        )
        .run(nextUpdatedAt, charCount, current.id, this.userId);
    });
    tx();
  }

  async deleteDocument(documentUuid: string): Promise<void> {
    this.ensureUserExists();
    const current = this.getDocumentRowByUuid(documentUuid);
    if (!current) return;
    const tx = this.db.transaction(() => {
      this.db
        .prepare(`DELETE FROM ${SQLiteTables.documentContent} WHERE document_row_id = ? AND user_id = ?`)
        .run(current.id, this.userId);
      this.db
        .prepare(`DELETE FROM ${SQLiteTables.documents} WHERE id = ? AND user_id = ?`)
        .run(current.id, this.userId);
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
