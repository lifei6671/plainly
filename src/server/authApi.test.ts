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
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "plainly-auth-api-"));
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
    shareCachePurger: null,
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

const requestJson = async (input: {
  origin: string;
  path: string;
  method?: string;
  body?: unknown;
}): Promise<{status: number; json: any}> => {
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
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode || 0,
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

describe("auth api", () => {
  it("returns chinese message when login credentials are invalid", async () => {
    const ctx = await startServer();

    try {
      const response = await requestJson({
        origin: ctx.origin,
        path: "/api/auth/login",
        method: "POST",
        body: {
          account: "missing-user",
          password: "wrong-password",
        },
      });

      expect(response.status).toBe(401);
      expect(response.json).toMatchObject({
        errcode: 1,
        errmsg: "用户名或密码错误",
        data: null,
      });
    } finally {
      await ctx.close();
    }
  });
});
