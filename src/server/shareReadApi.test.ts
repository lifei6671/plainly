import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

import {createServerApp} from "./index";
import {NodeDataStore} from "./NodeDataStore";

declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => Promise<void> | void) => void;
declare const expect: any;

const createTempDbPath = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plainly-share-read-"));
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

const startServer = async () => {
  const {dir, dbPath} = createTempDbPath();
  const storeFactory = new NodeDataStore(dbPath);
  await storeFactory.init();
  const app = createServerApp({
    storeFactory,
    apiPrefix: "/api",
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

const requestRaw = async (input: {
  origin: string;
  path: string;
  method?: string;
  body?: string;
  contentType?: string;
  cookie?: string;
  accessToken?: string;
  accept?: string;
}): Promise<{status: number; headers: http.IncomingHttpHeaders; text: string}> =>
  new Promise((resolve, reject) => {
    const payload = input.body ?? "";
    const url = new URL(input.path, input.origin);
    const req = http.request(
      {
        method: input.method || "GET",
        agent: false,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        headers: {
          Connection: "close",
          ...(input.accept ? {Accept: input.accept} : {}),
          ...(input.contentType ? {"Content-Type": input.contentType} : {}),
          ...(payload ? {"Content-Length": Buffer.byteLength(payload)} : {}),
          ...(input.cookie ? {Cookie: input.cookie} : {}),
          ...(input.accessToken ? {Authorization: `Bearer ${input.accessToken}`} : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          resolve({
            status: res.statusCode || 0,
            headers: res.headers,
            text: Buffer.concat(chunks).toString("utf8"),
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

const requestJson = async (input: {
  origin: string;
  path: string;
  method?: string;
  body?: unknown;
  cookie?: string;
  accessToken?: string;
}): Promise<{status: number; headers: http.IncomingHttpHeaders; json: any}> => {
  const payload = input.body == null ? null : JSON.stringify(input.body);
  const response = await requestRaw({
    origin: input.origin,
    path: input.path,
    method: input.method,
    body: payload || "",
    contentType: payload ? "application/json" : undefined,
    cookie: input.cookie,
    accessToken: input.accessToken,
  });
  return {
    status: response.status,
    headers: response.headers,
    json: response.text ? JSON.parse(response.text) : null,
  };
};

describe("public share read routes", () => {
  it("renders read list and public article pages", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "read-list-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const store = ctx.storeFactory.forUser(user.id);
      const publicDocument = await store.createDocument(
        {
          name: "公开文章",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now() - 2000,
          updatedAt: Date.now() - 1000,
          source: "remote",
          version: 1,
        },
        "# hello",
      );
      const protectedDocument = await store.createDocument(
        {
          name: "不在首页展示",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now() - 1000,
          updatedAt: Date.now() - 500,
          source: "remote",
          version: 1,
        },
        "# hidden",
      );

      await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(publicDocument.document_id)}/settings`,
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
      const publicSnapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(publicDocument.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: '<h1>公开文章</h1><p>欢迎阅读</p><img src="./uploads/hello.txt" alt="demo">',
          titleSnapshot: "公开文章",
          excerptSnapshot: "欢迎阅读",
          snapshotVersion: 10,
        },
      });

      await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(protectedDocument.document_id)}/settings`,
        method: "PUT",
        accessToken,
        body: {
          share: {
            enabled: true,
            accessType: "password",
            durationType: "permanent",
            password: "secret-pass",
          },
        },
      });

      const shareId = publicSnapshot.json.data.share.shareId;
      fs.mkdirSync(path.join(ctx.dir, "uploads"), {recursive: true});
      fs.writeFileSync(path.join(ctx.dir, "uploads", "hello.txt"), "asset-from-share", "utf8");

      const listPage = await requestRaw({
        origin: ctx.origin,
        path: "/read",
        accept: "text/html",
      });

      expect(listPage.status).toBe(200);
      expect(listPage.text).toContain("公开文档列表");
      expect(listPage.text).toContain("公开文章");
      expect(listPage.text).not.toContain("不在首页展示");
      expect(listPage.headers["cache-control"]).toBe("no-store");

      const articlePage = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}`,
        accept: "text/html",
      });

      expect(articlePage.status).toBe(200);
      expect(articlePage.text).toContain("公开文章");
      expect(articlePage.text).toContain(`/read/${encodeURIComponent(shareId)}/assets/uploads%2Fhello.txt`);
      expect(String(articlePage.headers["content-security-policy"] || "")).toContain("script-src 'sha256-");
      expect(String(articlePage.headers["content-security-policy"] || "")).not.toContain("script-src 'unsafe-inline'");
      expect(articlePage.headers["cache-control"]).toBe("public, max-age=60, must-revalidate");

      const contentJson = await requestJson({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/content`,
        method: "GET",
      });

      expect(contentJson.status).toBe(200);
      expect(contentJson.json.data.html).toContain(`/read/${encodeURIComponent(shareId)}/assets/uploads%2Fhello.txt`);

      const assetResponse = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/assets/${encodeURIComponent("uploads/hello.txt")}`,
        method: "GET",
      });

      expect(assetResponse.status).toBe(200);
      expect(assetResponse.text).toBe("asset-from-share");
    } finally {
      await ctx.close();
    }
  });

  it("does not CDN-cache paginated or explicit list query variants", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "share-list-variant-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const store = ctx.storeFactory.forUser(user.id);
      const createdAt = Date.now() - 5000;

      for (let i = 0; i < 2; i += 1) {
        const document = await store.createDocument(
          {
            name: `列表文档-${i + 1}`,
            category_id: "00000000000000000000000000000001",
            createdAt: createdAt + i,
            updatedAt: createdAt + i,
            source: "remote",
            version: 1,
          },
          "# list",
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
              listed: true,
            },
          },
        });
      }

      const explicitFirstPage = await requestRaw({
        origin: ctx.origin,
        path: "/read?page=1",
        accept: "text/html",
      });
      expect(explicitFirstPage.status).toBe(200);
      expect(explicitFirstPage.headers["cache-control"]).toBe("no-store");
      expect(explicitFirstPage.headers["cdn-cache-control"]).toBe("no-store");
    } finally {
      await ctx.close();
    }
  });

  it("uses long CDN cache only for old public SSR pages", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "share-cache-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const oldUpdatedAt = Date.now() - 8 * 24 * 60 * 60 * 1000;
      const document = await ctx.storeFactory.forUser(user.id).createDocument(
        {
          name: "老文章",
          category_id: "00000000000000000000000000000001",
          createdAt: oldUpdatedAt,
          updatedAt: oldUpdatedAt,
          source: "remote",
          version: 1,
        },
        "# old",
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

      const snapshot = await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: "<h1>老文章</h1><p>缓存测试</p>",
          titleSnapshot: "老文章",
          excerptSnapshot: "缓存测试",
          snapshotVersion: 1,
        },
      });
      const shareId = settings.json.data.share.shareId;
      expect(snapshot.status).toBe(200);

      const articlePage = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}`,
        accept: "text/html",
      });

      expect(articlePage.status).toBe(200);
      expect(articlePage.headers["cache-control"]).toBe("public, max-age=60, must-revalidate");
      expect(articlePage.headers["cdn-cache-control"]).toBe("public, max-age=604800");
    } finally {
      await ctx.close();
    }
  });

  it("requires password grant before reading protected content", async () => {
    const ctx = await startServer();

    try {
      const register = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/register",
        method: "POST",
        body: {
          account: "read-password-user",
          password: "share-password",
        },
      });
      const user = register.json.data.user;
      const accessToken = register.json.data.accessToken;
      const store = ctx.storeFactory.forUser(user.id);
      const document = await store.createDocument(
        {
          name: "受保护文章",
          category_id: "00000000000000000000000000000001",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          source: "remote",
          version: 1,
        },
        "# secret",
      );

      const settings = await requestJson({
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
      await requestJson({
        origin: ctx.origin,
        path: `/api/documents/${encodeURIComponent(document.document_id)}/share/snapshot`,
        method: "PUT",
        accessToken,
        body: {
          htmlSnapshot: "<h1>受保护文章</h1><p>仅授权后可看</p>",
          titleSnapshot: "受保护文章",
          excerptSnapshot: "仅授权后可看",
          snapshotVersion: 1,
        },
      });
      const shareId = settings.json.data.share.shareId;

      const passwordPage = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}`,
        accept: "text/html",
      });

      expect(passwordPage.status).toBe(200);
      expect(passwordPage.text).toContain("访问密码");

      const deniedContent = await requestJson({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/content`,
        method: "GET",
      });

      expect(deniedContent.status).toBe(403);

      const wrongPassword = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/access`,
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        body: "password=wrong-pass",
      });

      expect(wrongPassword.status).toBe(302);
      expect(wrongPassword.headers.location).toBe(`/read/${encodeURIComponent(shareId)}?error=password`);

      const grant = await requestRaw({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/access`,
        method: "POST",
        contentType: "application/x-www-form-urlencoded",
        body: "password=open-sesame",
      });

      expect(grant.status).toBe(302);
      expect(grant.headers.location).toBe(`/read/${encodeURIComponent(shareId)}`);
      const cookie = toCookieHeader(grant.headers);
      expect(cookie).toContain("plainly_share_access=");

      const allowedContent = await requestJson({
        origin: ctx.origin,
        path: `/read/${encodeURIComponent(shareId)}/content`,
        method: "GET",
        cookie,
      });

      expect(allowedContent.status).toBe(200);
      expect(allowedContent.json.data.title).toBe("受保护文章");
      expect(allowedContent.json.data.html).toContain("仅授权后可看");
    } finally {
      await ctx.close();
    }
  });
});
