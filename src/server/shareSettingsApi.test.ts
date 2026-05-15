import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

import {createServerApp} from "./index";
import {NodeDataStore} from "./NodeDataStore";
import {ShareCachePurger} from "../share";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

const createTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plainly-share-api-"));
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

const startServer = async (options?: {shareCachePurger?: ShareCachePurger | null}) => {
  const {dir, dbPath} = createTempDbPath();
  const storeFactory = new NodeDataStore(dbPath);
  await storeFactory.init();
  const app = createServerApp({
    storeFactory,
    apiPrefix: "/api",
    shareCachePurger: options?.shareCachePurger || null,
  });
  const server = await new Promise<http.Server>((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("failed to resolve test server address");
  }
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    dir,
    storeFactory,
    server,
    origin,
    async close() {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
      cleanupTempDir(dir);
    },
  };
};

const toCookieHeader = (headers: http.IncomingHttpHeaders): string => {
  const values = headers["set-cookie"];
  if (!values || !values.length) return "";
  return values.map((value) => String(value).split(";")[0]).join("; ");
};

const requestJson = async (input: {
  origin: string;
  path: string;
  method?: string;
  body?: unknown;
  cookie?: string;
  accessToken?: string;
  headers?: Record<string, string>;
}): Promise<{status: number; headers: http.IncomingHttpHeaders; json: any}> => {
  const payload = input.body == null ? null : JSON.stringify(input.body);
  return new Promise((resolve, reject) => {
    const url = new URL(input.path, input.origin);
    const req = http.request(
      {
        method: input.method || "GET",
        agent: false,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          "Content-Type": "application/json",
          Connection: "close",
          ...(payload ? {"Content-Length": Buffer.byteLength(payload)} : {}),
          ...(input.cookie ? {Cookie: input.cookie} : {}),
          ...(input.accessToken ? {Authorization: `Bearer ${input.accessToken}`} : {}),
          ...(input.headers || {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            json: text ? JSON.parse(text) : null,
          });
        });
      },
    );
    req.on("error", reject);
    if (payload) {
      req.write(payload);
    }
    req.end();
  });
};

describe("document share settings api", () => {
  it("creates, reads and updates share settings", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "share-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const document = await ctx.storeFactory.forUser(user.id).createDocument(
        {
          name: "分享设置测试",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "remote",
          version: 1,
        },
        "# hello",
      );

      const createSettings = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        body: {
          share: {
            enabled: true,
            accessType: "password",
            durationType: "permanent",
            password: "open-sesame",
          },
        },
      });

      expect(createSettings.status).toBe(200);
      expect(createSettings.json.data.share).toMatchObject({
        enabled: true,
        accessType: "password",
        durationType: "permanent",
        listed: false,
        passwordConfigured: true,
        passwordVersion: 1,
      });

      const readSettings = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "GET",
        accessToken,
      });

      expect(readSettings.status).toBe(200);
      expect(readSettings.json.data.meta.document_id).toBe(document.document_id);
      expect(readSettings.json.data.share).toMatchObject({
        enabled: true,
        accessType: "password",
        listed: false,
        passwordConfigured: true,
        passwordVersion: 1,
      });

      const nextShareId = readSettings.json.data.share.shareId;
      const makePublic = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        body: {
          meta: {
            name: "分享设置测试-已公开",
          },
          share: {
            enabled: true,
            accessType: "public",
            durationType: "permanent",
            listed: true,
            regenerateShareId: true,
          },
        },
      });

      expect(makePublic.status).toBe(200);
      expect(makePublic.json.data.meta.name).toBe("分享设置测试-已公开");
      expect(makePublic.json.data.share).toMatchObject({
        enabled: true,
        accessType: "public",
        durationType: "permanent",
        listed: true,
        passwordConfigured: false,
      });
      expect(makePublic.json.data.share.passwordVersion).toBeNull();
      expect(makePublic.json.data.share.shareId).not.toBe(nextShareId);
    } finally {
      await ctx.close();
    }
  });

  it("purges affected read caches after share settings changes", async () => {
    const purgeCalls: string[][] = [];
    const ctx = await startServer({
      shareCachePurger: {
        async purgeByUrls(urls) {
          purgeCalls.push(urls);
        },
      },
    });

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "purge-settings-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const document = await ctx.storeFactory.forUser(user.id).createDocument(
        {
          name: "缓存失效测试",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "remote",
          version: 1,
        },
        "# hello",
      );

      const firstSettings = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        headers: {
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Host": "plainly.example.com",
        },
        body: {
          share: {
            enabled: true,
            accessType: "public",
            durationType: "permanent",
            listed: true,
          },
        },
      });

      expect(firstSettings.status).toBe(200);
      expect(purgeCalls).toHaveLength(1);
      const firstShareId = firstSettings.json.data.share.shareId;
      expect(purgeCalls[0].sort()).toEqual(
        [`https://plainly.example.com/read`, `https://plainly.example.com/read/${encodeURIComponent(firstShareId)}`].sort(),
      );

      const secondSettings = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        headers: {
          "X-Forwarded-Proto": "https",
          "X-Forwarded-Host": "plainly.example.com",
        },
        body: {
          share: {
            enabled: true,
            accessType: "public",
            durationType: "permanent",
            listed: true,
            regenerateShareId: true,
          },
        },
      });

      expect(secondSettings.status).toBe(200);
      expect(purgeCalls).toHaveLength(2);
      const secondShareId = secondSettings.json.data.share.shareId;
      expect(purgeCalls[1].sort()).toEqual(
        [
          `https://plainly.example.com/read`,
          `https://plainly.example.com/read/${encodeURIComponent(firstShareId)}`,
          `https://plainly.example.com/read/${encodeURIComponent(secondShareId)}`,
        ].sort(),
      );
    } finally {
      await ctx.close();
    }
  });

  it("sanitizes snapshot content and rejects stale snapshot versions", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "snapshot-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const document = await ctx.storeFactory.forUser(user.id).createDocument(
        {
          name: "快照测试",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "remote",
          version: 1,
        },
        "# hello",
      );

      await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        body: {
          share: {
            enabled: true,
            accessType: "public",
            durationType: "permanent",
          },
        },
      });

      const firstSnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot:
            '<h1 onclick="alert(1)">Hello</h1><p>World</p><img src="./uploads/hello.png?token=1"/><img src="/private/cover.png"/><img src="https://example.com/outside.png"/><script>alert(1)</script>',
          titleSnapshot: "Hello",
          excerptSnapshot: "World",
          snapshotVersion: 1,
        },
      });

      expect(firstSnapshot.status).toBe(200);
      expect(firstSnapshot.json.data.share.snapshotVersion).toBe(1);
      expect(firstSnapshot.json.data.share.snapshotHash).toBeTruthy();
      expect(firstSnapshot.json.data.share.htmlSnapshot).not.toContain("onclick");
      expect(firstSnapshot.json.data.share.htmlSnapshot).not.toContain("<script");
      expect(firstSnapshot.json.data.share.passwordConfigured).toBe(false);
      const assets = await ctx.storeFactory.forUser(user.id).listDocumentShareAssets(document.document_id);
      expect(assets).toHaveLength(2);
      expect(assets.map((item) => item.assetId).sort()).toEqual(["/private/cover.png", "uploads/hello.png"]);

      const retrySnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot:
            '<h1 onclick="alert(1)">Hello</h1><p>World</p><img src="./uploads/hello.png?token=1"/><img src="/private/cover.png"/><img src="https://example.com/outside.png"/><script>alert(1)</script>',
          titleSnapshot: "Hello",
          excerptSnapshot: "World",
          snapshotVersion: 1,
        },
      });

      expect(retrySnapshot.status).toBe(200);
      expect(retrySnapshot.json.data.share.snapshotHash).toBe(firstSnapshot.json.data.share.snapshotHash);

      const staleSnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: "<h1>Changed</h1>",
          titleSnapshot: "Changed",
          excerptSnapshot: "Changed",
          snapshotVersion: 1,
        },
      });

      expect(staleSnapshot.status).toBe(409);
      expect(staleSnapshot.json.errmsg).toContain("snapshot");
    } finally {
      await ctx.close();
    }
  });

  it("purges share page and list after accepted snapshot updates", async () => {
    const purgeCalls: string[][] = [];
    const ctx = await startServer({
      shareCachePurger: {
        async purgeByUrls(urls) {
          purgeCalls.push(urls);
        },
      },
    });

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "purge-snapshot-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const document = await ctx.storeFactory.forUser(user.id).createDocument(
        {
          name: "快照缓存测试",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
          source: "remote",
          version: 1,
        },
        "# hello",
      );

      const settings = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/settings`,
        method: "PUT",
        accessToken,
        body: {
          share: {
            enabled: true,
            accessType: "public",
            durationType: "permanent",
            listed: true,
          },
        },
      });
      const shareId = settings.json.data.share.shareId;

      const firstSnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: "<h1>第一次快照</h1>",
          titleSnapshot: "第一次快照",
          excerptSnapshot: "第一版摘要",
          snapshotVersion: 1,
        },
      });

      expect(firstSnapshot.status).toBe(200);
      expect(purgeCalls[purgeCalls.length - 1].sort()).toEqual(
        [`${ctx.origin}/read`, `${ctx.origin}/read/${encodeURIComponent(shareId)}`].sort(),
      );

      const retrySnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: "<h1>第一次快照</h1>",
          titleSnapshot: "第一次快照",
          excerptSnapshot: "第一版摘要",
          snapshotVersion: 1,
        },
      });

      expect(retrySnapshot.status).toBe(200);
      expect(purgeCalls).toHaveLength(2);
    } finally {
      await ctx.close();
    }
  });
});
