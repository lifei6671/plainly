import {TextDecoder, TextEncoder} from "util";

const globalWithWebApis = global as typeof globalThis & {
  TextDecoder?: typeof TextDecoder;
  TextEncoder?: typeof TextEncoder;
};

globalWithWebApis.TextDecoder = TextDecoder;
globalWithWebApis.TextEncoder = TextEncoder;

const {handleApiRequest} = require("../../worker/api") as typeof import("../../worker/api");
const {SQLiteTables} = require("../../worker/schema.generated.js") as typeof import("../../worker/schema.generated.js");

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

const schemaColumns = {
  [SQLiteTables.users]: [
    "id",
    "account",
    "password",
    "password_salt",
    "registered_at",
    "last_login_at",
    "last_login_ip",
    "status",
    "password_changed_at",
    "token_version",
    "updated_at",
  ],
  [SQLiteTables.sessions]: [
    "id",
    "user_id",
    "device_id",
    "refresh_token_hash",
    "created_at",
    "expires_at",
    "revoked_at",
    "last_seen_at",
    "ip",
    "ua",
  ],
  [SQLiteTables.categories]: ["id", "user_id", "category_id", "name", "created_at", "updated_at", "source", "version"],
  [SQLiteTables.documents]: [
    "id",
    "user_id",
    "document_id",
    "name",
    "category",
    "category_id",
    "created_at",
    "updated_at",
    "content_norm",
    "char_count",
    "source",
    "version",
  ],
  [SQLiteTables.documentContent]: ["document_row_id", "user_id", "content"],
  [SQLiteTables.settings]: ["id", "user_id", "key", "value"],
  [SQLiteTables.documentShares]: [
    "id",
    "user_id",
    "document_id",
    "share_id",
    "enabled",
    "listed",
    "access_type",
    "duration_type",
    "start_at",
    "end_at",
    "password_hash",
    "password_salt",
    "password_algo",
    "password_version",
    "html_snapshot",
    "title_snapshot",
    "excerpt_snapshot",
    "snapshot_version",
    "snapshot_hash",
    "last_snapshot_at",
    "created_at",
    "updated_at",
  ],
  [SQLiteTables.documentShareAssets]: ["id", "user_id", "document_id", "asset_id", "snapshot_hash", "updated_at"],
};

const createCurrentSchemaD1 = () => {
  const queries: string[] = [];
  const writes: string[] = [];
  const database = {
    prepare(sql: string) {
      queries.push(sql);
      const statement = {
        bind() {
          return statement;
        },
        async all() {
          const match = sql.match(/^PRAGMA table_info\((.+)\)$/);
          if (!match) return {results: []};
          const table = match[1];
          const columns = schemaColumns[table] || [];
          return {
            results: columns.map((name, index) => ({
              name,
              pk: (table === SQLiteTables.categories || table === SQLiteTables.documents) && name === "id" ? 1 : 0,
              cid: index,
            })),
          };
        },
        async first() {
          return null;
        },
        async run() {
          writes.push(sql);
          return {meta: {last_row_id: 0}};
        },
      };
      return statement;
    },
  };
  return {database, queries, writes};
};

describe("worker auth api", () => {
  it("does not run schema migrations before login when D1 already has the current schema", async () => {
    const d1 = createCurrentSchemaD1();
    const request = new Request("https://plainly.example/api/auth/login", {
      method: "POST",
      body: JSON.stringify({account: "missing-user", password: "wrong-password"}),
      headers: {"Content-Type": "application/json"},
    });

    const response = await handleApiRequest(request, {DB: d1.database});

    expect(response?.status).toBe(401);
    expect(d1.queries).toHaveLength(Object.keys(schemaColumns).length + 1);
    expect(d1.writes).toEqual([]);
  });
});
