import MarkdownIt from "markdown-it";
import {SQLiteTables as SQLITE_TABLES, SQLiteDDL as SQLITE_DDL} from "./schema.generated.js";

const DEFAULT_API_PREFIX = "/api";
const ACCESS_COOKIE = "plainly_at";
const REFRESH_COOKIE = "plainly_rt";
const SESSION_FLAG_COOKIE = "plainly_session";

const DEFAULT_CATEGORY_ID = 1;
const DEFAULT_CATEGORY_UUID = "00000000000000000000000000000001";
const DEFAULT_CATEGORY_NAME = "默认目录";
const MIGRATION_USER_ID = 1;

// SQLite 表结构由 schema.generated.js 输出，避免重复维护

// 仅用于提取可见文本的 Markdown 解析器（不渲染 HTML）
const markdownParserRaw = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: false,
});

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const toMillis = (v) => {
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

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const normalizeUuid = (value) => {
  if (!value) return "";
  return String(value).trim().replace(/-/g, "");
};

const bytesToHex = (bytes) =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

const hexToBytes = (hex) => {
  const normalized = (hex || "").trim();
  if (!normalized) return new Uint8Array();
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
};

const base64UrlEncode = (bytes) => {
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

const base64UrlDecodeToBytes = (value) => {
  let input = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = input.length % 4;
  if (padding) {
    input += "=".repeat(4 - padding);
  }
  const binary = atob(input);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const base64UrlDecodeToString = (value) => textDecoder.decode(base64UrlDecodeToBytes(value));

// 生成无连字符 UUID
const generateUuid = () => {
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  // 按 RFC4122 v4 规范设置版本位
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  return bytesToHex(buf);
};

// 从 Markdown 中提取可见文本，且排除代码块/行内代码
const extractVisibleTextNoCode = (markdown) => {
  const tokens = markdownParserRaw.parse(markdown ?? "", {});
  const parts = [];
  const walk = (toks) => {
    for (const token of toks) {
      if (token.type === "text" && token.content) {
        parts.push(token.content);
        continue;
      }
      if (token.type === "image" && token.content) {
        parts.push(token.content);
        continue;
      }
      if (token.type === "code_inline" || token.type === "code_block" || token.type === "fence") {
        continue;
      }
      if (token.children && token.children.length) {
        walk(token.children);
      }
    }
  };
  walk(tokens);
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

// 构建用于 LIKE 搜索的规范化文本：合并标题与正文并统一处理
const buildContentNorm = (title, markdown) => {
  const combined = `${title || ""}\n${markdown || ""}`;
  const text = extractVisibleTextNoCode(combined);
  return text.toLowerCase();
};

// LIKE 查询时需要转义的特殊字符
const escapeLikeValue = (value) => value.replace(/[\\%_]/g, "\\$&");

const normalizeSource = (value) => (value === "local" || value === "remote" ? value : undefined);

const mapDoc = (row) => ({
  id: toNumber(row.id),
  document_id: row.document_id,
  name: row.name,
  category_id: row.category_id,
  createdAt: toNumber(row.created_at),
  updatedAt: toNumber(row.updated_at),
  charCount: row.char_count ?? undefined,
  source: normalizeSource(row.source),
  version: row.version ?? undefined,
  uid: toNumber(row.user_id),
});

const mapCategory = (row) => ({
  id: toNumber(row.id),
  category_id: row.category_id,
  name: row.name,
  createdAt: toNumber(row.created_at),
  updatedAt: toNumber(row.updated_at),
  source: normalizeSource(row.source),
  version: row.version ?? undefined,
  uid: toNumber(row.user_id),
});

const mapUser = (row) => ({
  id: toNumber(row.id),
  account: row.account,
  password: row.password,
  passwordSalt: row.password_salt ?? null,
  registeredAt: toNumber(row.registered_at),
  lastLoginAt: row.last_login_at ?? null,
  lastLoginIp: row.last_login_ip ?? null,
  status: row.status ?? 1,
  passwordChangedAt: row.password_changed_at ?? null,
  tokenVersion: row.token_version ?? 1,
});

const readJson = async (request) => {
  try {
    return await request.json();
  } catch (_e) {
    return {};
  }
};

const parseCookies = (header) => {
  const result = {};
  if (!header) return result;
  header.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (!name) return;
    result[name] = decodeURIComponent(rest.join("="));
  });
  return result;
};

const buildCookie = (name, value, options = {}) => {
  const parts = [`${name}=${encodeURIComponent(value ?? "")}`];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.path) parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.sameSite) parts.push(`SameSite=${options.sameSite}`);
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
};

const buildCorsHeaders = (request) => {
  const headers = new Headers();
  const origin = request.headers.get("Origin");
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Credentials", "true");
    headers.set("Vary", "Origin");
  }
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,PUT,DELETE,OPTIONS");
  return headers;
};

const jsonResponse = (request, data, status = 200, cookies = []) => {
  const headers = buildCorsHeaders(request);
  headers.set("Content-Type", "application/json");
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(JSON.stringify({errcode: 0, errmsg: "ok", data}), {status, headers});
};

const errorResponse = (request, errmsg = "请求失败", status = 400, errcode = 1, cookies = []) => {
  const headers = buildCorsHeaders(request);
  headers.set("Content-Type", "application/json");
  cookies.forEach((cookie) => headers.append("Set-Cookie", cookie));
  return new Response(JSON.stringify({errcode, errmsg, data: null}), {status, headers});
};

const normalizeApiPrefix = (value) => {
  const raw = (value || DEFAULT_API_PREFIX).trim();
  if (!raw) return DEFAULT_API_PREFIX;
  const normalized = raw.startsWith("/") ? raw : `/${raw}`;
  if (normalized.length > 1 && normalized.endsWith("/")) {
    return normalized.slice(0, -1);
  }
  return normalized;
};

const timingSafeEqual = (a, b) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
};

// 生成 HMAC-SHA256 签名
const hmacSha256 = async (secret, message) => {
  const key = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(secret),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, textEncoder.encode(message));
  return new Uint8Array(signature);
};

const signJwt = async (payload, secret, expiresSec) => {
  const header = {alg: "HS256", typ: "JWT"};
  const nowSec = Math.floor(Date.now() / 1000);
  const body = {...payload};
  if (body.iat == null) body.iat = nowSec;
  if (expiresSec != null && body.exp == null) {
    body.exp = nowSec + expiresSec;
  }
  const headerB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(textEncoder.encode(JSON.stringify(body)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await hmacSha256(secret, data);
  return `${data}.${base64UrlEncode(signature)}`;
};

const verifyJwt = async (token, secret) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) throw new Error("invalid token");
  const [headerB64, payloadB64, signatureB64] = parts;
  const data = `${headerB64}.${payloadB64}`;
  const expected = await hmacSha256(secret, data);
  if (!timingSafeEqual(signatureB64, base64UrlEncode(expected))) {
    throw new Error("invalid token");
  }
  const payload = JSON.parse(base64UrlDecodeToString(payloadB64));
  if (payload.exp && Math.floor(Date.now() / 1000) > payload.exp) {
    throw new Error("token expired");
  }
  return payload;
};

// PBKDF2-SHA512 密码摘要
const hashPassword = async (password, saltHex) => {
  const salt = saltHex ? hexToBytes(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", textEncoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const derived = await crypto.subtle.deriveBits(
    {name: "PBKDF2", salt, iterations: 10000, hash: "SHA-512"},
    key,
    512,
  );
  return {hash: bytesToHex(new Uint8Array(derived)), salt: bytesToHex(salt)};
};

const sha256Hex = async (value) => {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(String(value || "")));
  return bytesToHex(new Uint8Array(digest));
};

const parseBearer = (request) => {
  const header = request.headers.get("Authorization") || request.headers.get("authorization");
  if (!header) return null;
  const parts = header.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
};

const dbAll = async (db, sql, params = []) => {
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const result = await stmt.all();
  return result?.results ?? [];
};

const dbFirst = async (db, sql, params = []) => {
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  const result = await stmt.first();
  return result ?? null;
};

const dbRun = async (db, sql, params = []) => {
  const stmt = params.length ? db.prepare(sql).bind(...params) : db.prepare(sql);
  return stmt.run();
};

const tableInfo = async (db, table) => dbAll(db, `PRAGMA table_info(${table})`);

// 批量执行 SQL（按分号切分，忽略空语句）
const runStatements = async (db, sql) => {
  const raw = String(sql || "");
  const parts = raw
    .split(";")
    .map((stmt) => stmt.trim())
    .filter(Boolean);
  for (const statement of parts) {
    await dbRun(db, statement);
  }
};

const migrateCategoriesPrimaryKey = async (db) => {
  const info = await tableInfo(db, SQLITE_TABLES.categories);
  const newTableName = `${SQLITE_TABLES.categories}_new`;
  const newInfo = await tableInfo(db, newTableName);
  if (!info.length) {
    if (newInfo.length) {
      await dbRun(db, `ALTER TABLE ${newTableName} RENAME TO ${SQLITE_TABLES.categories}`);
      await dbRun(
        db,
        `CREATE INDEX IF NOT EXISTS idx_categories_user ON ${SQLITE_TABLES.categories}(user_id)`,
      );
    }
    return;
  }
  if (newInfo.length) {
    await dbRun(db, `DROP TABLE ${newTableName}`);
  }
  const hasUserColumn = info.some((c) => c.name === "user_id");
  const pkColumns = info.filter((c) => c.pk > 0).map((c) => c.name);
  const hasIdPrimaryKey = pkColumns.length === 1 && pkColumns[0] === "id";
  if (hasUserColumn && hasIdPrimaryKey) {
    return;
  }
  const hasCategoryId = info.some((c) => c.name === "category_id");
  const hasLegacyUuid = info.some((c) => c.name === "category_uuid");
  const hasSource = info.some((c) => c.name === "source");
  const hasVersion = info.some((c) => c.name === "version");

  const fkRow = await dbFirst(db, "PRAGMA foreign_keys");
  const foreignKeysEnabled = toNumber(fkRow?.foreign_keys, 0) === 1;
  await runStatements(db, "PRAGMA foreign_keys = OFF;");

  try {
    await runStatements(
      db,
      SQLITE_DDL.categories.replace(SQLITE_TABLES.categories, newTableName),
    );

    const selectColumns = ["id", "name", "created_at", "updated_at"];
    if (hasUserColumn) selectColumns.push("user_id");
    if (hasCategoryId) selectColumns.push("category_id");
    if (hasLegacyUuid) selectColumns.push("category_uuid");
    if (hasSource) selectColumns.push("source");
    if (hasVersion) selectColumns.push("version");
    const rows = await dbAll(
      db,
      `SELECT ${selectColumns.join(", ")} FROM ${SQLITE_TABLES.categories}`,
    );

    const userRowExists = async (userId) =>
      dbFirst(db, `SELECT id FROM ${SQLITE_TABLES.users} WHERE id = ?`, [userId]);
    const accountExists = async (account) =>
      dbFirst(db, `SELECT id FROM ${SQLITE_TABLES.users} WHERE account = ?`, [account]);
    const ensureUserRow = async (userId) => {
      if (await userRowExists(userId)) return;
      const now = Date.now();
      const baseAccount = `legacy_${userId}`;
      let account = baseAccount;
      let suffix = 0;
      while (await accountExists(account)) {
        suffix += 1;
        account = `${baseAccount}_${suffix}`;
      }
      await dbRun(
        db,
        `INSERT INTO ${SQLITE_TABLES.users}
         (id, account, password, registered_at, last_login_at, last_login_ip, status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, account, "", now, now, "0.0.0.0", 1, now],
      );
    };

    const insertCategory = async (
      userId,
      categoryUuid,
      name,
      createdAt,
      updatedAt,
      source,
      version,
    ) => {
      const result = await dbRun(
        db,
        `INSERT OR IGNORE INTO ${newTableName}
         (user_id, category_id, name, created_at, updated_at, source, version)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [userId, categoryUuid, name, createdAt, updatedAt, source, version],
      );
      let newId = toNumber(result?.meta?.last_row_id, 0);
      if (!newId) {
        const row = await dbFirst(
          db,
          `SELECT id FROM ${newTableName} WHERE user_id = ? AND category_id = ?`,
          [userId, categoryUuid],
        );
        newId = toNumber(row?.id, 0);
      }
      return newId;
    };

    const idMap = new Map();
    const newIdByCategoryKey = new Map();
    const defaultIdByUser = new Map();
    const seenUsers = new Set();
    const now = Date.now();
    const ensureDefault = async (userId) => {
      const resolvedUserId = toNumber(userId, MIGRATION_USER_ID);
      await ensureUserRow(resolvedUserId);
      if (defaultIdByUser.has(resolvedUserId)) return;
      const newId = await insertCategory(
        resolvedUserId,
        DEFAULT_CATEGORY_UUID,
        DEFAULT_CATEGORY_NAME,
        now,
        now,
        "remote",
        1,
      );
      defaultIdByUser.set(resolvedUserId, newId);
    };

    for (const row of rows) {
      const userId = hasUserColumn ? toNumber(row.user_id, MIGRATION_USER_ID) : MIGRATION_USER_ID;
      await ensureUserRow(userId);
      seenUsers.add(userId);
      const rawCategoryId = hasCategoryId
        ? row.category_id
        : hasLegacyUuid
          ? row.category_uuid
          : null;
      let categoryUuid = normalizeUuid(rawCategoryId || "");
      if (!categoryUuid) {
        categoryUuid = toNumber(row.id, 0) === DEFAULT_CATEGORY_ID ? DEFAULT_CATEGORY_UUID : generateUuid();
      }
      const createdAt = toNumber(row.created_at, now) || now;
      const updatedAt = toNumber(row.updated_at, createdAt) || createdAt;
      const source = row.source || "remote";
      const version = row.version ?? 1;
      const categoryKey = `${userId}:${categoryUuid}`;
      let newId = newIdByCategoryKey.get(categoryKey);
      if (!newId) {
        newId = await insertCategory(
          userId,
          categoryUuid,
          String(row.name || DEFAULT_CATEGORY_NAME),
          createdAt,
          updatedAt,
          source,
          version,
        );
        newIdByCategoryKey.set(categoryKey, newId);
      }
      idMap.set(`${userId}:${toNumber(row.id, 0)}`, newId);
      if (categoryUuid === DEFAULT_CATEGORY_UUID && !defaultIdByUser.has(userId)) {
        defaultIdByUser.set(userId, newId);
      }
    }

    for (const userId of seenUsers) {
      await ensureDefault(userId);
    }

    const docInfo = await tableInfo(db, SQLITE_TABLES.documents);
    if (docInfo.length) {
      const docHasUser = docInfo.some((c) => c.name === "user_id");
      const docColumns = ["id", "category"];
      if (docHasUser) docColumns.push("user_id");
      const docs = await dbAll(
        db,
        `SELECT ${docColumns.join(", ")} FROM ${SQLITE_TABLES.documents}`,
      );
      for (const doc of docs) {
        const userId = docHasUser ? toNumber(doc.user_id, MIGRATION_USER_ID) : MIGRATION_USER_ID;
        await ensureUserRow(userId);
        const oldCategoryId = toNumber(doc.category, DEFAULT_CATEGORY_ID);
        let nextId = idMap.get(`${userId}:${oldCategoryId}`);
        if (!nextId) {
          await ensureDefault(userId);
          nextId = defaultIdByUser.get(userId);
        }
        if (nextId && nextId !== oldCategoryId) {
          if (docHasUser) {
            await dbRun(
              db,
              `UPDATE ${SQLITE_TABLES.documents} SET category = ? WHERE user_id = ? AND id = ?`,
              [nextId, userId, doc.id],
            );
          } else {
            await dbRun(
              db,
              `UPDATE ${SQLITE_TABLES.documents} SET category = ? WHERE id = ?`,
              [nextId, doc.id],
            );
          }
        }
      }
    }

    await dbRun(db, `DROP TABLE ${SQLITE_TABLES.categories}`);
    await dbRun(db, `ALTER TABLE ${newTableName} RENAME TO ${SQLITE_TABLES.categories}`);
    await dbRun(
      db,
      `CREATE INDEX IF NOT EXISTS idx_categories_user ON ${SQLITE_TABLES.categories}(user_id)`,
    );
  } finally {
    await runStatements(db, `PRAGMA foreign_keys = ${foreignKeysEnabled ? "ON" : "OFF"};`);
  }
};

let schemaReadyPromise = null;

// 初始化 D1 结构与必要字段
const ensureSchema = async (db) => {
  if (schemaReadyPromise) return schemaReadyPromise;
  schemaReadyPromise = (async () => {
    await runStatements(db, "PRAGMA foreign_keys = ON;");
    await runStatements(db, SQLITE_DDL.users);
    await runStatements(db, SQLITE_DDL.sessions);
    await runStatements(db, SQLITE_DDL.categories);
    await runStatements(db, SQLITE_DDL.documents);
    await runStatements(db, SQLITE_DDL.documentContent);
    await runStatements(db, SQLITE_DDL.settings);

    const usersInfo = await tableInfo(db, SQLITE_TABLES.users);
    if (!usersInfo.some((c) => c.name === "password_salt")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.users} ADD COLUMN password_salt TEXT;`);
    }
    if (!usersInfo.some((c) => c.name === "token_version")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.users} ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1;`);
    }
    if (!usersInfo.some((c) => c.name === "password_changed_at")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.users} ADD COLUMN password_changed_at INTEGER;`);
    }

    const categoriesInfo = await tableInfo(db, SQLITE_TABLES.categories);
    if (!categoriesInfo.some((c) => c.name === "category_id")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.categories} ADD COLUMN category_id TEXT;`);
    }
    if (!categoriesInfo.some((c) => c.name === "source")) {
      await runStatements(
        `ALTER TABLE ${SQLITE_TABLES.categories} ADD COLUMN source TEXT NOT NULL DEFAULT 'remote';`,
      );
    }
    if (!categoriesInfo.some((c) => c.name === "version")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.categories} ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
    }

    await migrateCategoriesPrimaryKey(db);

    const documentsInfo = await tableInfo(db, SQLITE_TABLES.documents);
    if (!documentsInfo.some((c) => c.name === "document_id")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.documents} ADD COLUMN document_id TEXT;`);
    }
    if (!documentsInfo.some((c) => c.name === "category_id")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.documents} ADD COLUMN category_id TEXT;`);
    }
    if (!documentsInfo.some((c) => c.name === "source")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.documents} ADD COLUMN source TEXT NOT NULL DEFAULT 'remote';`);
    }
    if (!documentsInfo.some((c) => c.name === "version")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.documents} ADD COLUMN version INTEGER NOT NULL DEFAULT 1;`);
    }
    if (!documentsInfo.some((c) => c.name === "content_norm")) {
      await runStatements(db, `ALTER TABLE ${SQLITE_TABLES.documents} ADD COLUMN content_norm TEXT NOT NULL DEFAULT '';`);
    }

    await runStatements(db, `CREATE INDEX IF NOT EXISTS idx_documents_user ON ${SQLITE_TABLES.documents}(user_id);`);
    await runStatements(db, `CREATE INDEX IF NOT EXISTS idx_categories_user ON ${SQLITE_TABLES.categories}(user_id);`);
    await runStatements(
      `CREATE INDEX IF NOT EXISTS idx_document_content_user ON ${SQLITE_TABLES.documentContent}(user_id);`,
    );
    await runStatements(db, `CREATE INDEX IF NOT EXISTS idx_settings_user ON ${SQLITE_TABLES.settings}(user_id);`);
    await runStatements(db, `CREATE INDEX IF NOT EXISTS idx_sessions_user ON ${SQLITE_TABLES.sessions}(user_id);`);

    // 回填缺失的 content_norm，确保 LIKE 搜索可用
    const rows = await dbAll(
      db,
      `SELECT d.id, d.user_id, d.name, d.content_norm, c.content
       FROM ${SQLITE_TABLES.documents} d
       LEFT JOIN ${SQLITE_TABLES.documentContent} c
         ON c.document_row_id = d.id AND c.user_id = d.user_id
       WHERE d.content_norm IS NULL OR d.content_norm = ''`,
    );
    for (const row of rows) {
      const nextNorm = buildContentNorm(row.name || "", row.content || "");
      await dbRun(
        db,
        `UPDATE ${SQLITE_TABLES.documents} SET content_norm = ? WHERE user_id = ? AND id = ?`,
        [nextNorm, row.user_id, row.id],
      );
    }
  })();
  return schemaReadyPromise;
};

// 确保默认目录存在
const ensureDefaultCategoryForUser = async (db, userId) => {
  if (!userId || userId <= 0) return;
  const row = await dbFirst(
    db,
    `SELECT id, category_id FROM ${SQLITE_TABLES.categories} WHERE user_id = ? AND category_id = ?`,
    [userId, DEFAULT_CATEGORY_UUID],
  );
  if (row) return;
  const now = Date.now();
  await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.categories}
     (user_id, category_id, name, created_at, updated_at, source, version)
     VALUES (?, ?, ?, ?, ?, 'remote', 1)`,
    [userId, DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME, now, now],
  );
};

const getUserById = async (db, userId) =>
  dbFirst(db, `SELECT * FROM ${SQLITE_TABLES.users} WHERE id = ?`, [userId]);

const getUserByAccount = async (db, account) =>
  dbFirst(db, `SELECT * FROM ${SQLITE_TABLES.users} WHERE account = ?`, [account]);

const touchLogin = async (db, userId, ip) => {
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.users} SET last_login_at = ?, last_login_ip = ?, updated_at = ? WHERE id = ?`,
    [now, ip || null, now, userId],
  );
};

const createUser = async (db, account, password) => {
  const exists = await getUserByAccount(db, account);
  if (exists) throw new Error("account already exists");
  const now = Date.now();
  const {hash, salt} = await hashPassword(password);
  const result = await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.users}
     (account, password, password_salt, registered_at, updated_at, status, token_version, password_changed_at)
     VALUES (?, ?, ?, ?, ?, 1, 1, ?)`,
    [account, hash, salt, now, now, now],
  );
  const id = toNumber(result?.meta?.last_row_id, 0);
  return {id, account};
};

const verifyUser = async (db, account, password, ip) => {
  const row = await getUserByAccount(db, account);
  if (!row) return null;
  const {hash} = await hashPassword(password, row.password_salt || undefined);
  if (hash !== row.password) return null;
  await touchLogin(db, row.id, ip);
  return mapUser(row);
};

const updatePassword = async (db, userId, newPassword, oldPassword) => {
  const row = await getUserById(db, userId);
  if (!row) throw new Error("user not found");
  if (oldPassword) {
    const {hash} = await hashPassword(oldPassword, row.password_salt || undefined);
    if (hash !== row.password) throw new Error("old password not match");
  }
  const {hash, salt} = await hashPassword(newPassword);
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.users}
     SET password = ?, password_salt = ?, password_changed_at = ?, token_version = COALESCE(token_version, 1) + 1, updated_at = ?
     WHERE id = ?`,
    [hash, salt, now, now, userId],
  );
};

const createSession = async (db, userId, refreshToken, expiresAt, meta = {}) => {
  const now = Date.now();
  const hash = await sha256Hex(refreshToken);
  await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.sessions}
     (id, user_id, device_id, refresh_token_hash, created_at, expires_at, last_seen_at, ip, ua)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      meta.id,
      userId,
      meta.deviceId || null,
      hash,
      now,
      expiresAt,
      now,
      meta.ip || null,
      meta.ua || null,
    ],
  );
};

const getSession = async (db, sessionId) =>
  dbFirst(db, `SELECT * FROM ${SQLITE_TABLES.sessions} WHERE id = ?`, [sessionId]);

const rotateSession = async (db, sessionId, refreshToken, expiresAt) => {
  const hash = await sha256Hex(refreshToken);
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.sessions}
     SET refresh_token_hash = ?, expires_at = ?, last_seen_at = ?
     WHERE id = ?`,
    [hash, expiresAt, now, sessionId],
  );
};

const cleanupExpiredSessions = async (db) => {
  const now = Date.now();
  await dbRun(db, `DELETE FROM ${SQLITE_TABLES.sessions} WHERE expires_at < ?`, [now]);
};

const validateRefreshToken = async (db, sessionId, token) => {
  await cleanupExpiredSessions(db);
  const session = await getSession(db, sessionId);
  if (!session) return null;
  if (session.revoked_at) return null;
  if (toMillis(session.expires_at) < Date.now()) return null;
  const incomingHash = await sha256Hex(token);
  if (incomingHash !== session.refresh_token_hash) return null;
  return session;
};

const revokeSession = async (db, sessionId) => {
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.sessions} SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL`,
    [now, sessionId],
  );
};

const revokeUserSessions = async (db, userId) => {
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.sessions} SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL`,
    [now, userId],
  );
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.users}
     SET token_version = COALESCE(token_version, 1) + 1, updated_at = ?
     WHERE id = ?`,
    [now, userId],
  );
};

const getCategoryRowByUuid = async (db, userId, categoryUuid) => {
  const normalized = normalizeUuid(categoryUuid);
  if (!normalized) return null;
  return dbFirst(
    db,
    `SELECT * FROM ${SQLITE_TABLES.categories} WHERE user_id = ? AND category_id = ?`,
    [userId, normalized],
  );
};

const getDocumentRowByUuid = async (db, userId, documentUuid) => {
  const normalized = normalizeUuid(documentUuid);
  if (!normalized) return null;
  return dbFirst(
    db,
    `SELECT * FROM ${SQLITE_TABLES.documents} WHERE user_id = ? AND document_id = ?`,
    [userId, normalized],
  );
};

const requireAuth = async (request, env, db) => {
  const token = parseBearer(request) || parseCookies(request.headers.get("Cookie"))[ACCESS_COOKIE] || null;
  if (!token) return null;
  const jwtSecret = env.JWT_SECRET || "change-me-in-prod";
  const payload = await verifyJwt(token, jwtSecret);
  const userId = toNumber(payload.sub, 0);
  if (!userId || userId <= 0) throw new Error("invalid token");
  const row = await getUserById(db, userId);
  if (!row || row.status === 0) throw new Error("user disabled");
  const user = mapUser(row);
  if (payload.ver != null && user.tokenVersion != null && payload.ver !== user.tokenVersion) {
    throw new Error("token expired");
  }
  if (user.passwordChangedAt && payload.iat && payload.iat * 1000 < toMillis(user.passwordChangedAt)) {
    throw new Error("password changed");
  }
  return {userId, user};
};

const buildRuntimeConfig = (env, request) => {
  const apiPrefix = normalizeApiPrefix(env.API_PREFIX);
  const accessEnv = env.ACCESS_TOKEN_TTL_MS ? Number(env.ACCESS_TOKEN_TTL_MS) : NaN;
  const refreshEnv = env.REFRESH_TOKEN_TTL_MS ? Number(env.REFRESH_TOKEN_TTL_MS) : NaN;
  const accessTtlMs = Number.isFinite(accessEnv) ? accessEnv : 10 * 60 * 1000;
  const refreshTtlMs = Number.isFinite(refreshEnv) ? refreshEnv : 14 * 24 * 60 * 60 * 1000;
  const isSecure = new URL(request.url).protocol === "https:";
  return {apiPrefix, accessTtlMs, refreshTtlMs, isSecure};
};

const setAuthCookies = (cookies, config, accessToken, refreshToken, refreshExpires) => {
  const refreshMaxAge = Math.max(0, Math.floor((refreshExpires - Date.now()) / 1000));
  const accessMaxAge = Math.max(0, Math.floor(config.accessTtlMs / 1000));
  cookies.push(
    buildCookie(ACCESS_COOKIE, accessToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: config.isSecure,
      path: config.apiPrefix,
      maxAge: accessMaxAge,
    }),
  );
  cookies.push(
    buildCookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      sameSite: "Lax",
      secure: config.isSecure,
      path: config.apiPrefix,
      maxAge: refreshMaxAge,
    }),
  );
  cookies.push(
    buildCookie(SESSION_FLAG_COOKIE, "1", {
      httpOnly: false,
      sameSite: "Lax",
      secure: config.isSecure,
      path: "/",
      maxAge: refreshMaxAge,
    }),
  );
};

const clearAuthCookies = (cookies, config) => {
  const base = {
    httpOnly: true,
    sameSite: "Lax",
    secure: config.isSecure,
    path: config.apiPrefix,
    maxAge: 0,
  };
  cookies.push(buildCookie(ACCESS_COOKIE, "", base));
  cookies.push(buildCookie(REFRESH_COOKIE, "", base));
  cookies.push(
    buildCookie(SESSION_FLAG_COOKIE, "", {
      httpOnly: false,
      sameSite: "Lax",
      secure: config.isSecure,
      path: "/",
      maxAge: 0,
    }),
  );
};

const signAccessToken = async (user, env, config) => {
  const payload = {sub: user.id, ver: user.tokenVersion ?? 1};
  return signJwt(payload, env.JWT_SECRET || "change-me-in-prod", Math.floor(config.accessTtlMs / 1000));
};

const signRefreshToken = async (sessionId, expiresAt, env) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = Math.floor(expiresAt / 1000);
  return signJwt({sid: sessionId, iat: nowSec, exp: expSec}, env.JWT_SECRET || "change-me-in-prod");
};

const listCategories = async (db, userId) => {
  await ensureDefaultCategoryForUser(db, userId);
  const rows = await dbAll(
    db,
    `SELECT id, category_id, name, created_at, updated_at, source, version, user_id
     FROM ${SQLITE_TABLES.categories}
     WHERE user_id = ?
     ORDER BY created_at ASC`,
    [userId],
  );
  return rows.map(mapCategory);
};

const listCategoriesWithCount = async (db, userId) => {
  await ensureDefaultCategoryForUser(db, userId);
  const rows = await dbAll(
    db,
    `SELECT c.id, c.category_id, c.name, c.created_at, c.updated_at, c.source, c.version, c.user_id, COUNT(d.id) as count
     FROM ${SQLITE_TABLES.categories} c
     LEFT JOIN ${SQLITE_TABLES.documents} d
       ON d.category = c.id AND d.user_id = c.user_id
     WHERE c.user_id = ?
     GROUP BY c.id, c.user_id
     ORDER BY c.created_at ASC`,
    [userId],
  );
  return rows.map((row) => ({...mapCategory(row), count: toNumber(row.count, 0)}));
};

const createCategory = async (db, userId, name, options = {}) => {
  const trimmed = String(name || "").trim();
  if (!trimmed) throw new Error("category name required");
  const existingByName = await dbFirst(
    db,
    `SELECT * FROM ${SQLITE_TABLES.categories} WHERE user_id = ? AND name = ?`,
    [userId, trimmed],
  );
  if (existingByName) return mapCategory(existingByName);
  let categoryUuid = normalizeUuid(options.category_id ? String(options.category_id).trim() : "");
  if (!categoryUuid) categoryUuid = generateUuid();
  const existingByUuid = await dbFirst(
    db,
    `SELECT * FROM ${SQLITE_TABLES.categories} WHERE user_id = ? AND category_id = ?`,
    [userId, categoryUuid],
  );
  if (existingByUuid) {
    categoryUuid = generateUuid();
  }
  const now = Date.now();
  const source = options.source || "remote";
  const version = options.version ?? 1;
  const result = await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.categories}
     (user_id, category_id, name, created_at, updated_at, source, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, categoryUuid, trimmed, now, now, source, version],
  );
  const id = toNumber(result?.meta?.last_row_id, 0);
  return {
    id,
    category_id: categoryUuid,
    name: trimmed,
    createdAt: now,
    updatedAt: now,
    source,
    version,
    uid: userId,
  };
};

const renameCategory = async (db, userId, categoryUuid, name) => {
  const row = await getCategoryRowByUuid(db, userId, categoryUuid);
  if (!row) return;
  const now = Date.now();
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.categories}
     SET name = ?, updated_at = ?, version = COALESCE(version, 1) + 1
     WHERE user_id = ? AND id = ?`,
    [name, now, userId, row.id],
  );
};

const deleteCategory = async (db, userId, categoryUuid, options = {}) => {
  const row = await getCategoryRowByUuid(db, userId, categoryUuid);
  if (!row) return;
  if (row.category_id === DEFAULT_CATEGORY_UUID) return;
  const targetUuid = options.reassignTo || DEFAULT_CATEGORY_UUID;
  const targetRow = await getCategoryRowByUuid(db, userId, targetUuid);
  const fallbackRow = await getCategoryRowByUuid(db, userId, DEFAULT_CATEGORY_UUID);
  const resolvedTarget = targetRow || fallbackRow;
  const targetId = resolvedTarget ? resolvedTarget.id : row.id;
  const targetCategoryUuid = resolvedTarget ? resolvedTarget.category_id : DEFAULT_CATEGORY_UUID;
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.documents}
     SET category = ?, category_id = ?
     WHERE user_id = ? AND category = ?`,
    [targetId, targetCategoryUuid, userId, row.id],
  );
  await dbRun(
    db,
    `DELETE FROM ${SQLITE_TABLES.categories} WHERE user_id = ? AND id = ?`,
    [userId, row.id],
  );
};

const createDocument = async (db, userId, meta, content) => {
  await ensureDefaultCategoryForUser(db, userId);
  const createdAt = toMillis(meta.createdAt ?? Date.now());
  const updatedAt = toMillis(meta.updatedAt ?? createdAt);
  const charCount = meta.charCount ?? content.length;
  const contentNorm = buildContentNorm(meta.name, content);
  const incomingCategoryUuid = normalizeUuid(meta.category_id ? String(meta.category_id) : "") || DEFAULT_CATEGORY_UUID;
  const defaultCategoryRow = await getCategoryRowByUuid(db, userId, DEFAULT_CATEGORY_UUID);
  const categoryRow =
    (await getCategoryRowByUuid(db, userId, incomingCategoryUuid)) || defaultCategoryRow;
  const categoryId = categoryRow ? categoryRow.id : defaultCategoryRow?.id ?? 0;
  const categoryUuid = categoryRow ? categoryRow.category_id : DEFAULT_CATEGORY_UUID;
  let documentUuid = normalizeUuid(meta.document_id ? String(meta.document_id).trim() : "");
  if (!documentUuid) documentUuid = generateUuid();
  const source = meta.source || "remote";
  const version = meta.version ?? 1;
  const existing = await dbFirst(
    db,
    `SELECT * FROM ${SQLITE_TABLES.documents} WHERE user_id = ? AND document_id = ?`,
    [userId, documentUuid],
  );
  if (existing) {
    const existingVersion = toNumber(existing.version, 1);
    if (version > existingVersion) {
      await dbRun(
        db,
        `UPDATE ${SQLITE_TABLES.documents}
         SET name = ?, category = ?, category_id = ?, updated_at = ?, content_norm = ?, char_count = ?, source = ?, version = ?
         WHERE user_id = ? AND id = ?`,
        [
          meta.name,
          categoryId,
          categoryUuid,
          updatedAt,
          contentNorm,
          charCount,
          source,
          version,
          userId,
          existing.id,
        ],
      );
      await dbRun(
        db,
        `INSERT INTO ${SQLITE_TABLES.documentContent} (document_row_id, user_id, content)
         VALUES (?, ?, ?)
         ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
        [existing.id, userId, content],
      );
    }
    const row = await getDocumentRowByUuid(db, userId, documentUuid);
    return row ? mapDoc(row) : mapDoc(existing);
  }
  const result = await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.documents}
     (user_id, document_id, name, category, category_id, created_at, updated_at, content_norm, char_count, source, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      documentUuid,
      meta.name,
      categoryId,
      categoryUuid,
      createdAt,
      updatedAt,
      contentNorm,
      charCount,
      source,
      version,
    ],
  );
  const id = toNumber(result?.meta?.last_row_id, 0);
  await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.documentContent} (document_row_id, user_id, content)
     VALUES (?, ?, ?)
     ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
    [id, userId, content],
  );
  return {
    id,
    document_id: documentUuid,
    name: meta.name,
    category_id: categoryUuid,
    createdAt,
    updatedAt,
    charCount,
    source,
    version,
    uid: userId,
  };
};

const updateDocumentMeta = async (db, userId, documentUuid, updates) => {
  const current = await getDocumentRowByUuid(db, userId, documentUuid);
  if (!current) return;
  const fields = [];
  const values = [];
  if (updates.name !== undefined) {
    fields.push("name = ?");
    values.push(updates.name);
    const contentRow = await dbFirst(
      db,
      `SELECT content FROM ${SQLITE_TABLES.documentContent} WHERE document_row_id = ? AND user_id = ?`,
      [current.id, userId],
    );
    const nextContentNorm = buildContentNorm(String(updates.name ?? current.name), contentRow?.content ?? "");
    fields.push("content_norm = ?");
    values.push(nextContentNorm);
  }
  if (updates.category_id !== undefined) {
    const normalizedCategory = normalizeUuid(String(updates.category_id));
    const categoryRow =
      (await getCategoryRowByUuid(db, userId, normalizedCategory || String(updates.category_id))) ||
      (await getCategoryRowByUuid(db, userId, DEFAULT_CATEGORY_UUID));
    const nextCategoryId = categoryRow ? categoryRow.id : current.category;
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
  values.push(userId, current.id);
  const sql = `UPDATE ${SQLITE_TABLES.documents} SET ${fields.join(", ")} WHERE user_id = ? AND id = ?`;
  await dbRun(db, sql, values);
};

const listDocumentsPage = async (db, userId, offset, limit) => {
  const items = await dbAll(
    db,
    `SELECT * FROM ${SQLITE_TABLES.documents}
     WHERE user_id = ?
     ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [userId, limit, offset],
  );
  const totalRow = await dbFirst(
    db,
    `SELECT COUNT(*) as c FROM ${SQLITE_TABLES.documents} WHERE user_id = ?`,
    [userId],
  );
  const mapped = items.map(mapDoc);
  const hasMore = toNumber(totalRow?.c, 0) > offset + mapped.length;
  return {items: mapped, hasMore};
};

const listAllDocuments = async (db, userId) => {
  const rows = await dbAll(
    db,
    `SELECT * FROM ${SQLITE_TABLES.documents} WHERE user_id = ? ORDER BY created_at DESC`,
    [userId],
  );
  return rows.map(mapDoc);
};

const searchDocumentsByTokens = async (db, userId, tokens, options = {}) => {
  const normalizedTokens = Array.from(
    new Set(
      (tokens || [])
        .map((t) => String(t || "").trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  const limit = Math.max(1, Number(options.limit ?? 20));
  const offset = Math.max(0, Number(options.offset ?? 0));
  const whereParts = ["user_id = ?"];
  const params = [userId];
  if (options.categoryId) {
    const normalizedCategory = normalizeUuid(String(options.categoryId));
    whereParts.push("category_id = ?");
    params.push(normalizedCategory || String(options.categoryId));
  }
  normalizedTokens.forEach((token) => {
    whereParts.push(`content_norm LIKE ? ESCAPE '\\'`);
    params.push(`%${escapeLikeValue(token)}%`);
  });
  const whereClause = whereParts.join(" AND ");
  const items = await dbAll(
    db,
    `SELECT * FROM ${SQLITE_TABLES.documents}
     WHERE ${whereClause}
     ORDER BY updated_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const totalRow = await dbFirst(
    db,
    `SELECT COUNT(*) as c FROM ${SQLITE_TABLES.documents} WHERE ${whereClause}`,
    params,
  );
  const mapped = items.map(mapDoc);
  const hasMore = toNumber(totalRow?.c, 0) > offset + mapped.length;
  return {items: mapped, hasMore};
};

const ensureDocumentCharCount = async (db, userId, meta) => {
  if (meta.charCount != null) return meta;
  const content = await getDocumentContent(db, userId, meta.document_id);
  const charCount = content.length;
  await updateDocumentMeta(db, userId, meta.document_id, {charCount});
  return {...meta, charCount};
};

const getDocumentContent = async (db, userId, documentUuid) => {
  const current = await getDocumentRowByUuid(db, userId, documentUuid);
  if (!current) return "";
  const row = await dbFirst(
    db,
    `SELECT content FROM ${SQLITE_TABLES.documentContent} WHERE document_row_id = ? AND user_id = ?`,
    [current.id, userId],
  );
  return row?.content ?? "";
};

const saveDocumentContent = async (db, userId, documentUuid, content, updatedAt) => {
  const current = await getDocumentRowByUuid(db, userId, documentUuid);
  if (!current) return;
  const nextUpdatedAt = toMillis(updatedAt ?? Date.now());
  const charCount = content.length;
  const contentNorm = buildContentNorm(current.name, content);
  await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.documentContent} (document_row_id, user_id, content)
     VALUES (?, ?, ?)
     ON CONFLICT(document_row_id, user_id) DO UPDATE SET content=excluded.content`,
    [current.id, userId, content],
  );
  await dbRun(
    db,
    `UPDATE ${SQLITE_TABLES.documents}
     SET updated_at = ?, content_norm = ?, char_count = ?, version = COALESCE(version, 1) + 1
     WHERE id = ? AND user_id = ?`,
    [nextUpdatedAt, contentNorm, charCount, current.id, userId],
  );
};

const deleteDocument = async (db, userId, documentUuid) => {
  const current = await getDocumentRowByUuid(db, userId, documentUuid);
  if (!current) return;
  await dbRun(
    db,
    `DELETE FROM ${SQLITE_TABLES.documentContent} WHERE document_row_id = ? AND user_id = ?`,
    [current.id, userId],
  );
  await dbRun(
    db,
    `DELETE FROM ${SQLITE_TABLES.documents} WHERE id = ? AND user_id = ?`,
    [current.id, userId],
  );
};

const getConfig = async (db, userId, key, fallback) => {
  const row = await dbFirst(
    db,
    `SELECT value FROM ${SQLITE_TABLES.settings} WHERE key = ? AND user_id = ?`,
    [key, userId],
  );
  if (!row || row.value == null) return fallback ?? null;
  try {
    return JSON.parse(row.value);
  } catch (_e) {
    return row.value;
  }
};

const setConfig = async (db, userId, key, value) => {
  const payload = typeof value === "string" ? value : JSON.stringify(value);
  await dbRun(
    db,
    `INSERT INTO ${SQLITE_TABLES.settings} (user_id, key, value)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value`,
    [userId, key, payload],
  );
};

const removeConfig = async (db, userId, key) =>
  dbRun(db, `DELETE FROM ${SQLITE_TABLES.settings} WHERE key = ? AND user_id = ?`, [key, userId]);

const listConfigKeys = async (db, userId, prefix) => {
  if (prefix) {
    const rows = await dbAll(
      db,
      `SELECT key FROM ${SQLITE_TABLES.settings} WHERE user_id = ? AND key LIKE ?`,
      [userId, `${prefix}%`],
    );
    return rows.map((row) => row.key);
  }
  const rows = await dbAll(db, `SELECT key FROM ${SQLITE_TABLES.settings} WHERE user_id = ?`, [userId]);
  return rows.map((row) => row.key);
};

// Cloudflare Worker API 主入口
export async function handleApiRequest(request, env) {
  const url = new URL(request.url);
  const config = buildRuntimeConfig(env, request);
  if (!url.pathname.startsWith(config.apiPrefix)) {
    return null;
  }
  if (!env.DB) {
    return errorResponse(request, "未绑定 D1 数据库", 500);
  }
  if (request.method === "OPTIONS") {
    const headers = buildCorsHeaders(request);
    return new Response(null, {status: 204, headers});
  }
  await ensureSchema(env.DB);
  const subPath = url.pathname.slice(config.apiPrefix.length) || "/";
  const segments = subPath.split("/").filter(Boolean);
  const cookies = parseCookies(request.headers.get("Cookie"));

  try {
    if (segments[0] === "auth") {
      const action = segments[1];
      if (request.method === "POST" && action === "register") {
        const body = await readJson(request);
        const account = String(body.account || "").trim();
        const password = String(body.password || "");
        if (!account || !password) return errorResponse(request, "account and password required", 400);
        const user = await createUser(env.DB, account, password);
        await ensureDefaultCategoryForUser(env.DB, user.id);
        const accessToken = await signAccessToken({id: user.id, tokenVersion: 1}, env, config);
        const sessionExpires = Date.now() + config.refreshTtlMs;
        const sessionId = generateUuid();
        const refreshToken = await signRefreshToken(sessionId, sessionExpires, env);
        await createSession(env.DB, user.id, refreshToken, sessionExpires, {
          id: sessionId,
          ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For"),
          ua: request.headers.get("User-Agent"),
        });
        const outCookies = [];
        setAuthCookies(outCookies, config, accessToken, refreshToken, sessionExpires);
        return jsonResponse(request, {user: {id: user.id, account: user.account}, accessToken}, 200, outCookies);
      }
      if (request.method === "POST" && action === "login") {
        const body = await readJson(request);
        const account = String(body.account || "").trim();
        const password = String(body.password || "");
        if (!account || !password) return errorResponse(request, "account and password required", 400);
        const user = await verifyUser(
          env.DB,
          account,
          password,
          request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For"),
        );
        if (!user) return errorResponse(request, "invalid credentials", 401);
        const accessToken = await signAccessToken(user, env, config);
        const sessionId = generateUuid();
        const sessionExpires = Date.now() + config.refreshTtlMs;
        const refreshToken = await signRefreshToken(sessionId, sessionExpires, env);
        await createSession(env.DB, user.id, refreshToken, sessionExpires, {
          id: sessionId,
          ip: request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For"),
          ua: request.headers.get("User-Agent"),
        });
        const outCookies = [];
        setAuthCookies(outCookies, config, accessToken, refreshToken, sessionExpires);
        return jsonResponse(request, {user: {id: user.id, account: user.account}, accessToken}, 200, outCookies);
      }
      if (request.method === "POST" && action === "refresh") {
        const refreshToken = cookies[REFRESH_COOKIE];
        if (!refreshToken) return errorResponse(request, "refresh token required", 401);
        try {
          const decoded = await verifyJwt(refreshToken, env.JWT_SECRET || "change-me-in-prod");
          if (!decoded.sid) throw new Error("invalid token");
          const session = await validateRefreshToken(env.DB, decoded.sid, refreshToken);
          if (!session) throw new Error("invalid session");
          const userRow = await getUserById(env.DB, session.user_id);
          if (!userRow) throw new Error("user disabled");
          const user = mapUser(userRow);
          const newAccess = await signAccessToken(user, env, config);
          const newSessionExpires = Date.now() + config.refreshTtlMs;
          const newRefresh = await signRefreshToken(session.id, newSessionExpires, env);
          await rotateSession(env.DB, session.id, newRefresh, newSessionExpires);
          const outCookies = [];
          setAuthCookies(outCookies, config, newAccess, newRefresh, newSessionExpires);
          return jsonResponse(
            request,
            {user: {id: user.id, account: user.account}, accessToken: newAccess},
            200,
            outCookies,
          );
        } catch (_e) {
          const outCookies = [];
          clearAuthCookies(outCookies, config);
          return errorResponse(request, "invalid refresh token", 401, 1, outCookies);
        }
      }
      if (request.method === "POST" && action === "logout") {
        const refreshToken = cookies[REFRESH_COOKIE];
        if (refreshToken) {
          try {
            const decoded = await verifyJwt(refreshToken, env.JWT_SECRET || "change-me-in-prod");
            if (decoded.sid) {
              await revokeSession(env.DB, decoded.sid);
            }
          } catch (_e) {
            // 忽略错误
          }
        }
        const outCookies = [];
        clearAuthCookies(outCookies, config);
        return jsonResponse(request, {}, 200, outCookies);
      }
      if (request.method === "POST" && action === "logout-all") {
        let auth;
        try {
          auth = await requireAuth(request, env, env.DB);
        } catch (e) {
          return errorResponse(request, e?.message || "unauthorized", 401);
        }
        if (!auth) return errorResponse(request, "access token required", 401);
        await revokeUserSessions(env.DB, auth.userId);
        const outCookies = [];
        clearAuthCookies(outCookies, config);
        return jsonResponse(request, {}, 200, outCookies);
      }
      if (request.method === "POST" && action === "password") {
        let auth;
        try {
          auth = await requireAuth(request, env, env.DB);
        } catch (e) {
          return errorResponse(request, e?.message || "unauthorized", 401);
        }
        if (!auth) return errorResponse(request, "access token required", 401);
        const body = await readJson(request);
        if (!body.newPassword) return errorResponse(request, "newPassword required", 400);
        await updatePassword(
          env.DB,
          auth.userId,
          String(body.newPassword),
          body.oldPassword ? String(body.oldPassword) : undefined,
        );
        const outCookies = [];
        clearAuthCookies(outCookies, config);
        return jsonResponse(request, {}, 200, outCookies);
      }
      return errorResponse(request, "not found", 404);
    }

    let auth;
    try {
      auth = await requireAuth(request, env, env.DB);
    } catch (e) {
      return errorResponse(request, e?.message || "unauthorized", 401);
    }
    if (!auth) return errorResponse(request, "access token required", 401);
    const userId = auth.userId;

    if (segments[0] === "categories") {
      if (request.method === "GET" && segments.length === 1) {
        return jsonResponse(request, await listCategories(env.DB, userId));
      }
      if (request.method === "GET" && segments[1] === "count") {
        return jsonResponse(request, await listCategoriesWithCount(env.DB, userId));
      }
      if (request.method === "POST" && segments.length === 1) {
        const body = await readJson(request);
        const created = await createCategory(env.DB, userId, body.name, {
          category_id: body.category_id,
          source: body.source,
          version: body.version,
        });
        return jsonResponse(request, created);
      }
      if (request.method === "POST" && segments[1] === "batch") {
        const body = await readJson(request);
        const items = Array.isArray(body?.items) ? body.items : null;
        if (!items) return errorResponse(request, "items required", 400);
        const results = [];
        for (const item of items) {
          if (!item || !item.name) {
            results.push({client_id: item?.category_id, error: "name required"});
            continue;
          }
          try {
            const created = await createCategory(env.DB, userId, String(item.name), {
              category_id: item.category_id,
              source: item.source,
              version: item.version,
            });
            results.push({client_id: item.category_id, category: created});
          } catch (e) {
            results.push({client_id: item?.category_id, error: e?.message || "create failed"});
          }
        }
        return jsonResponse(request, {items: results});
      }
      if (request.method === "PATCH" && segments.length === 2) {
        const categoryId = decodeURIComponent(segments[1] || "");
        await renameCategory(env.DB, userId, categoryId, (await readJson(request)).name);
        return jsonResponse(request, {});
      }
      if (request.method === "DELETE" && segments.length === 2) {
        const categoryId = decodeURIComponent(segments[1] || "");
        const reassignTo = url.searchParams.get("reassignTo") || undefined;
        await deleteCategory(env.DB, userId, categoryId, {reassignTo});
        return jsonResponse(request, {});
      }
    }

    if (segments[0] === "documents") {
      if (request.method === "GET" && segments.length === 1) {
        const offset = Number(url.searchParams.get("offset") || 0);
        const limit = Number(url.searchParams.get("limit") || 20);
        return jsonResponse(request, await listDocumentsPage(env.DB, userId, offset, limit));
      }
      if (request.method === "GET" && segments[1] === "all") {
        return jsonResponse(request, await listAllDocuments(env.DB, userId));
      }
      if (request.method === "POST" && segments[1] === "search") {
        const body = await readJson(request);
        const tokens = body.tokens;
        if (!Array.isArray(tokens)) return errorResponse(request, "tokens required", 400);
        return jsonResponse(
          request,
          await searchDocumentsByTokens(env.DB, userId, tokens, {
            categoryId: body.category_id ? String(body.category_id) : undefined,
            offset: body.offset,
            limit: body.limit,
          }),
        );
      }
      if (request.method === "GET" && segments.length === 3 && segments[2] === "meta") {
        const documentId = decodeURIComponent(segments[1] || "");
        const row = await getDocumentRowByUuid(env.DB, userId, documentId);
        return jsonResponse(request, row ? mapDoc(row) : null);
      }
      if (request.method === "GET" && segments.length === 3 && segments[2] === "rename") {
        const documentId = decodeURIComponent(segments[1] || "");
        const row = await getDocumentRowByUuid(env.DB, userId, documentId);
        const categories = await listCategories(env.DB, userId);
        return jsonResponse(request, {meta: row ? mapDoc(row) : null, categories});
      }
      if (request.method === "PATCH" && segments.length === 3 && segments[2] === "meta") {
        const documentId = decodeURIComponent(segments[1] || "");
        const body = await readJson(request);
        await updateDocumentMeta(env.DB, userId, documentId, body || {});
        return jsonResponse(request, {});
      }
      if (request.method === "POST" && segments.length === 1) {
        const body = await readJson(request);
        if (!body?.meta || typeof body?.content !== "string") {
          return errorResponse(request, "invalid payload", 400);
        }
        const created = await createDocument(env.DB, userId, body.meta, body.content);
        return jsonResponse(request, created);
      }
      if (request.method === "POST" && segments[1] === "batch") {
        const body = await readJson(request);
        const items = Array.isArray(body?.items) ? body.items : null;
        if (!items) return errorResponse(request, "items required", 400);
        const results = [];
        for (const item of items) {
          if (!item || !item.meta || typeof item.content !== "string") {
            results.push({client_id: item?.meta?.document_id, error: "invalid payload"});
            continue;
          }
          try {
            const created = await createDocument(env.DB, userId, item.meta, item.content);
            results.push({client_id: item.meta.document_id, document: created});
          } catch (e) {
            results.push({client_id: item?.meta?.document_id, error: e?.message || "create failed"});
          }
        }
        return jsonResponse(request, {items: results});
      }
      if (request.method === "GET" && segments.length === 3 && segments[2] === "content") {
        const documentId = decodeURIComponent(segments[1] || "");
        return jsonResponse(request, await getDocumentContent(env.DB, userId, documentId));
      }
      if (request.method === "PUT" && segments.length === 3 && segments[2] === "content") {
        const documentId = decodeURIComponent(segments[1] || "");
        const body = await readJson(request);
        if (typeof body.content !== "string") return errorResponse(request, "content required", 400);
        await saveDocumentContent(env.DB, userId, documentId, body.content, body.updatedAt);
        return jsonResponse(request, {});
      }
      if (request.method === "DELETE" && segments.length === 2) {
        const documentId = decodeURIComponent(segments[1] || "");
        await deleteDocument(env.DB, userId, documentId);
        return jsonResponse(request, {});
      }
      if (request.method === "POST" && segments.length === 3 && segments[2] === "charcount") {
        const documentId = decodeURIComponent(segments[1] || "");
        const body = await readJson(request);
        const meta = body && body.document_id ? body : {...body, document_id: documentId};
        return jsonResponse(request, await ensureDocumentCharCount(env.DB, userId, meta));
      }
    }

    if (segments[0] === "config") {
      if (request.method === "GET" && segments.length === 1) {
        const prefix = url.searchParams.get("prefix") || undefined;
        return jsonResponse(request, await listConfigKeys(env.DB, userId, prefix));
      }
      if (request.method === "GET" && segments.length === 2) {
        const configKey = decodeURIComponent(segments[1] || "");
        let fallback;
        const fallbackParam = url.searchParams.get("fallback");
        if (fallbackParam) {
          try {
            fallback = JSON.parse(fallbackParam);
          } catch (_e) {
            fallback = undefined;
          }
        }
        return jsonResponse(request, await getConfig(env.DB, userId, configKey, fallback));
      }
      if (request.method === "PUT" && segments.length === 2) {
        const configKey = decodeURIComponent(segments[1] || "");
        const body = await readJson(request);
        await setConfig(env.DB, userId, configKey, body?.value);
        return jsonResponse(request, {});
      }
      if (request.method === "DELETE" && segments.length === 2) {
        const configKey = decodeURIComponent(segments[1] || "");
        await removeConfig(env.DB, userId, configKey);
        return jsonResponse(request, {});
      }
    }
  } catch (e) {
    return errorResponse(request, e?.message || "请求失败", 400);
  }

  return errorResponse(request, "not found", 404);
}
