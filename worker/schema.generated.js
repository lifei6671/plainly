// 本文件由 scripts/gen-worker-schema.mjs 自动生成，请勿手动修改。
export const SQLiteTables = {
  users: "users",
  documents: "documents",
  documentContent: "document_content",
  categories: "categories",
  settings: "user_setting",
  sessions: "user_sessions",
};

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
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      source TEXT NOT NULL DEFAULT 'remote',
      version INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, id),
      UNIQUE (user_id, category_id),
      UNIQUE (user_id, name),
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
};
