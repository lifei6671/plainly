import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";

import {NodeDataStore} from "./NodeDataStore";
import {SQLiteTables} from "../data/store/schema";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

const createTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plainly-share-store-"));
  return {
    dir,
    dbPath: path.join(dir, "plainly.db"),
  };
};

const cleanupTempDir = (dir: string) => {
  try {
    fs.rmSync(dir, {recursive: true, force: true});
  } catch (_error) {
    // Windows 下 sqlite 文件句柄释放有时略慢，这里不让清理错误覆盖真正的断言失败。
  }
};

describe("NodeDataStore document share storage", () => {
  it("creates missing parent directories before opening sqlite database", async () => {
    const {dir} = createTempDbPath();
    const nestedDir = path.join(dir, "missing", "nested");
    const dbPath = path.join(nestedDir, "plainly.db");

    try {
      expect(fs.existsSync(nestedDir)).toBe(false);

      const store = new NodeDataStore(dbPath, 1);
      await store.init();

      expect(fs.existsSync(nestedDir)).toBe(true);
      expect(fs.existsSync(dbPath)).toBe(true);
    } finally {
      cleanupTempDir(dir);
    }
  });

  it("bootstraps document share tables and indexes", async () => {
    const {dir, dbPath} = createTempDbPath();

    try {
      const store = new NodeDataStore(dbPath, 1);
      await store.init();

      const db = new Database(dbPath, {readonly: true});
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (?, ?)")
        .all(SQLiteTables.documentShares, SQLiteTables.documentShareAssets) as Array<{name: string}>;
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name IN (?, ?)")
        .all(SQLiteTables.documentShares, SQLiteTables.documentShareAssets) as Array<{name: string}>;

      expect(tables.map((item) => item.name).sort()).toEqual(
        [SQLiteTables.documentShareAssets, SQLiteTables.documentShares].sort(),
      );
      expect(indexes.map((item) => item.name)).toEqual(
        expect.arrayContaining([
          "idx_document_shares_document",
          "idx_document_shares_list",
          "idx_document_share_assets_document",
        ]),
      );
      db.close();
    } finally {
      cleanupTempDir(dir);
    }
  });

  it("persists document share rows and replaces asset relations", async () => {
    const {dir, dbPath} = createTempDbPath();

    try {
      const store = new NodeDataStore(dbPath, 1);
      const meta = await store.createDocument(
        {
          name: "公开测试文档",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "remote",
          version: 1,
        },
        "# hello",
      );

      await store.saveDocumentShare({
        documentId: meta.document_id,
        shareId: "share_demo_001",
        enabled: true,
        listed: true,
        accessType: "public",
        durationType: "permanent",
        startAt: null,
        endAt: null,
        passwordHash: null,
        passwordSalt: null,
        passwordAlgo: null,
        passwordVersion: null,
        htmlSnapshot: "<h1>hello</h1>",
        titleSnapshot: "hello",
        excerptSnapshot: "intro",
        snapshotVersion: 1,
        snapshotHash: "hash_v1",
        lastSnapshotAt: 1001,
      });

      await store.replaceDocumentShareAssets(meta.document_id, "hash_v1", ["asset-a", "asset-b"]);
      await store.replaceDocumentShareAssets(meta.document_id, "hash_v2", ["asset-b", "asset-c"]);

      const share = await store.getDocumentShare(meta.document_id);
      const assets = await store.listDocumentShareAssets(meta.document_id);

      expect(share).toMatchObject({
        documentId: meta.document_id,
        shareId: "share_demo_001",
        enabled: true,
        listed: true,
        snapshotHash: "hash_v1",
      });
      expect(assets).toEqual([
        expect.objectContaining({assetId: "asset-b", snapshotHash: "hash_v2"}),
        expect.objectContaining({assetId: "asset-c", snapshotHash: "hash_v2"}),
      ]);
    } finally {
      cleanupTempDir(dir);
    }
  });
});
