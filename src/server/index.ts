import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {NodeDataStore} from "./NodeDataStore";
import {UpdateDocumentMetaInput} from "../data/store";

type ServerConfig = {
  port?: number;
  apiPrefix?: string;
  dbFile?: string;
};

const loadConfig = (): ServerConfig => {
  const configPath = path.resolve(process.cwd(), "config", "server.config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    const raw = fs.readFileSync(configPath, "utf8");
    return JSON.parse(raw) as ServerConfig;
  } catch (e) {
    console.warn("Failed to read config/server.config.json:", e);
    return {};
  }
};

const cfg = loadConfig();
const PORT = process.env.PORT ? Number(process.env.PORT) : cfg.port ?? 8788;
const API_PREFIX = process.env.API_PREFIX || cfg.apiPrefix || "/api";
const DB_FILE = process.env.DB_FILE || cfg.dbFile || "data/plainly.db";
const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-prod";
const ACCESS_TOKEN_TTL_MS =
  process.env.ACCESS_TOKEN_TTL_MS != null ? Number(process.env.ACCESS_TOKEN_TTL_MS) : 10 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS =
  process.env.REFRESH_TOKEN_TTL_MS != null ? Number(process.env.REFRESH_TOKEN_TTL_MS) : 14 * 24 * 60 * 60 * 1000;
const ACCESS_COOKIE = "plainly_at";
const REFRESH_COOKIE = "plainly_rt";
const SESSION_FLAG_COOKIE = "plainly_session";
const isProd = process.env.NODE_ENV === "production";

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: isProd,
  path: API_PREFIX,
};

const sessionFlagBase = {
  httpOnly: false,
  sameSite: "lax" as const,
  secure: isProd,
  path: "/",
};

const toMillis = (v: any): number => {
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const parsed = Date.parse(v);
    if (!Number.isNaN(parsed)) return parsed;
    const num = Number(v);
    if (!Number.isNaN(num)) return num;
  }
  return 0;
};

const setAuthCookies = (res: express.Response, accessToken: string, refreshToken: string, refreshExpires: number) => {
  res.cookie(ACCESS_COOKIE, accessToken, {
    ...cookieBase,
    maxAge: ACCESS_TOKEN_TTL_MS,
  });
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...cookieBase,
    maxAge: refreshExpires - Date.now(),
  });
  res.cookie(SESSION_FLAG_COOKIE, "1", {
    ...sessionFlagBase,
    maxAge: refreshExpires - Date.now(),
  });
};

const clearAuthCookies = (res: express.Response) => {
  res.clearCookie(ACCESS_COOKIE, cookieBase);
  res.clearCookie(REFRESH_COOKIE, cookieBase);
  res.clearCookie(SESSION_FLAG_COOKIE, sessionFlagBase);
};

type AuthContext = {userId: number; store: ReturnType<NodeDataStore["forUser"]>; user: any};

const authRequired =
  (storeFactory: NodeDataStore) =>
  async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    try {
      const token = parseBearer(req) || ((req as any).cookies ? (req as any).cookies[ACCESS_COOKIE] : null);
      if (!token) return fail(res, "access token required", 401);
      const decoded = jwt.verify(token, JWT_SECRET) as {sub: number; ver?: number; iat?: number};
      const userId = Number(decoded.sub);
      if (!Number.isFinite(userId) || userId <= 0) return fail(res, "invalid token", 401);
      const user = storeFactory.getUser(userId);
      if (!user) return fail(res, "user disabled or missing", 401);
      if (decoded.ver != null && user.tokenVersion != null && decoded.ver !== user.tokenVersion) {
        return fail(res, "token expired", 401);
      }
      const pwdChangedMs = user.passwordChangedAt != null ? toMillis(user.passwordChangedAt) : null;
      if (pwdChangedMs && decoded.iat && decoded.iat * 1000 < pwdChangedMs) {
        return fail(res, "password changed", 401);
      }
      (req as any).auth = {userId, store: storeFactory.forUser(userId), user} as AuthContext;
      return next();
    } catch (e) {
      return fail(res, "unauthorized", 401);
    }
  };

const signAccessToken = (user: {id: number; tokenVersion?: number; passwordChangedAt?: any}) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    sub: user.id,
    ver: user.tokenVersion ?? 1,
    iat: nowSec,
  };
  return jwt.sign(payload, JWT_SECRET, {expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000)});
};

const signRefreshToken = (sessionId: string, expiresAt: number) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = Math.floor(expiresAt / 1000);
  return jwt.sign({sid: sessionId, iat: nowSec, exp: expSec}, JWT_SECRET);
};

const ok = (res: express.Response, data: any = {}) => res.json({errcode: 0, errmsg: "ok", data});
const fail = (res: express.Response, errmsg = "请求失败", status = 400, errcode = 1) =>
  res.status(status).json({errcode, errmsg, data: null});

const parseBearer = (req: express.Request): string | null => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const parts = header.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
};

async function main() {
  const storeFactory = new NodeDataStore(DB_FILE);
  await storeFactory.init();

  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(bodyParser.json({limit: "10mb"}));
  app.use(cookieParser());

  const router = express.Router();

  // auth
  router.post("/auth/register", async (req, res) => {
    const {account, password} = req.body || {};
    if (!account || !password) return fail(res, "account and password required", 400);
    try {
      const user = storeFactory.createUser(String(account).trim(), String(password));
      const accessToken = signAccessToken(user);
      const sessionExpires = Date.now() + REFRESH_TOKEN_TTL_MS;
      const sessionId = crypto.randomUUID();
      const refreshToken = signRefreshToken(sessionId, sessionExpires);
      storeFactory.createSession(user.id, refreshToken, sessionExpires, {
        id: sessionId,
        ip: req.ip,
        ua: req.headers["user-agent"] as string,
      });
      setAuthCookies(res, accessToken, refreshToken, sessionExpires);
      ok(res, {user: {id: user.id, account: user.account}, accessToken});
    } catch (e: any) {
      fail(res, e?.message || "register failed");
    }
  });

  router.post("/auth/login", async (req, res) => {
    const {account, password} = req.body || {};
    if (!account || !password) return fail(res, "account and password required");
    const user = storeFactory.verifyUser(String(account).trim(), String(password));
    if (!user) return fail(res, "invalid credentials", 401);
    const accessToken = signAccessToken(user);
    const sessionId = crypto.randomUUID();
    const sessionExpires = Date.now() + REFRESH_TOKEN_TTL_MS;
    const refreshToken = signRefreshToken(sessionId, sessionExpires);
    storeFactory.createSession(user.id, refreshToken, sessionExpires, {
      id: sessionId,
      ip: req.ip,
      ua: req.headers["user-agent"] as string,
    });
    setAuthCookies(res, accessToken, refreshToken, sessionExpires);
    ok(res, {
      user: {id: user.id, account: user.account},
      accessToken,
    });
  });

  router.post("/auth/refresh", async (req, res) => {
    const token = (req as any).cookies ? (req as any).cookies[REFRESH_COOKIE] : null;
    if (!token) return fail(res, "refresh token required", 401);
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {sid?: string};
      if (!decoded.sid) throw new Error("invalid");
      const session = storeFactory.validateRefreshToken(decoded.sid, token);
      if (!session) throw new Error("invalid session");
      const user = storeFactory.getUser(session.userId);
      if (!user) throw new Error("user disabled");
      const newAccess = signAccessToken(user);
      const newSessionExpires = Date.now() + REFRESH_TOKEN_TTL_MS;
      const newRefresh = signRefreshToken(session.id, newSessionExpires);
      storeFactory.rotateSession(session.id, newRefresh, newSessionExpires);
      setAuthCookies(res, newAccess, newRefresh, newSessionExpires);
      ok(res, {user: {id: user.id, account: user.account}, accessToken: newAccess});
    } catch (_e) {
      clearAuthCookies(res);
      return fail(res, "invalid refresh token", 401);
    }
  });

  router.post("/auth/logout", async (req, res) => {
    const token = (req as any).cookies ? (req as any).cookies[REFRESH_COOKIE] : null;
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as {sid?: string};
        if (decoded.sid) {
          storeFactory.revokeSession(decoded.sid);
        }
      } catch (_e) {
        // ignore
      }
    }
    clearAuthCookies(res);
    ok(res, {});
  });

  router.post("/auth/logout-all", authRequired(storeFactory), async (req, res) => {
    const {userId} = (req as any).auth as AuthContext;
    storeFactory.revokeUserSessions(userId);
    clearAuthCookies(res);
    ok(res, {});
  });

  router.post("/auth/password", authRequired(storeFactory), async (req, res) => {
    const {userId} = (req as any).auth as AuthContext;
    const {oldPassword, newPassword} = req.body || {};
    if (!newPassword) return fail(res, "newPassword required");
    try {
      storeFactory.updatePassword(userId, String(newPassword), oldPassword ? String(oldPassword) : undefined);
      clearAuthCookies(res);
      ok(res, {});
    } catch (e: any) {
      fail(res, e?.message || "update password failed");
    }
  });

  // 用户必需
  router.use(authRequired(storeFactory));

  // categories
  router.get("/categories", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    ok(res, await store.listCategories());
  });
  router.get("/categories/count", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    ok(res, await store.listCategoriesWithCount());
  });
  router.post("/categories", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const {name, category_id, source, version} = req.body || {};
    if (!name) return fail(res, "name required");
    ok(res, await store.createCategory(name, {category_id, source, version}));
  });
  router.post("/categories/batch", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return fail(res, "items required");
    const results: Array<{client_id?: string; category?: any; error?: string}> = [];
    for (const item of items) {
      if (!item || !item.name) {
        results.push({client_id: item?.category_id, error: "name required"});
        continue;
      }
      try {
        const created = await store.createCategory(String(item.name), {
          category_id: item.category_id,
          source: item.source,
          version: item.version,
        });
        results.push({client_id: item.category_id, category: created});
      } catch (e: any) {
        results.push({client_id: item.category_id, error: e?.message || "create failed"});
      }
    }
    ok(res, {items: results});
  });
  router.patch("/categories/:id", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    await store.renameCategory(String(req.params.id), req.body?.name);
    ok(res, {});
  });
  router.delete("/categories/:id", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const reassignTo = req.query.reassignTo ? String(req.query.reassignTo) : undefined;
    await store.deleteCategory(String(req.params.id), {reassignTo});
    ok(res, {});
  });

  // documents
  router.get("/documents", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);
    ok(res, await store.listDocumentsPage(offset, limit));
  });
  router.get("/documents/all", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    ok(res, await store.listAllDocuments());
  });
  router.post("/documents/search", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const {tokens, category_id, offset, limit} = req.body || {};
    if (!Array.isArray(tokens)) return fail(res, "tokens required");
    ok(
      res,
      await store.searchDocumentsByTokens(tokens, {
        categoryId: category_id ? String(category_id) : undefined,
        offset,
        limit,
      }),
    );
  });
  router.get("/documents/:id/meta", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    ok(res, await store.getDocumentMeta(String(req.params.id)));
  });
  router.patch("/documents/:id/meta", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    await store.updateDocumentMeta(String(req.params.id), req.body as UpdateDocumentMetaInput);
    ok(res, {});
  });
  router.post("/documents", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const {meta, content} = req.body || {};
    if (!meta || typeof content !== "string") return fail(res, "invalid payload");
    const created = await store.createDocument(meta, content);
    ok(res, created);
  });
  router.post("/documents/batch", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const items = Array.isArray(req.body?.items) ? req.body.items : null;
    if (!items) return fail(res, "items required");
    const results: Array<{client_id?: string; document?: any; error?: string}> = [];
    for (const item of items) {
      if (!item || !item.meta || typeof item.content !== "string") {
        results.push({client_id: item?.meta?.document_id, error: "invalid payload"});
        continue;
      }
      try {
        const created = await store.createDocument(item.meta, item.content);
        results.push({client_id: item.meta.document_id, document: created});
      } catch (e: any) {
        results.push({client_id: item.meta?.document_id, error: e?.message || "create failed"});
      }
    }
    ok(res, {items: results});
  });
  router.get("/documents/:id/content", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    ok(res, await store.getDocumentContent(String(req.params.id)));
  });
  router.put("/documents/:id/content", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const {content, updatedAt} = req.body || {};
    if (typeof content !== "string") return fail(res, "content required");
    await store.saveDocumentContent(String(req.params.id), content, updatedAt);
    ok(res, {});
  });
  router.delete("/documents/:id", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    await store.deleteDocument(String(req.params.id));
    ok(res, {});
  });
  router.post("/documents/:id/charcount", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const meta = req.body;
    ok(res, await store.ensureDocumentCharCount(meta));
  });

  // config
  router.get("/config", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
    ok(res, await store.listConfigKeys(prefix));
  });
  router.get("/config/:key", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    const fallback = req.query.fallback ? JSON.parse(String(req.query.fallback)) : undefined;
    ok(res, await store.getConfig(req.params.key, fallback));
  });
  router.put("/config/:key", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    await store.setConfig(req.params.key, req.body?.value);
    ok(res, {});
  });
  router.delete("/config/:key", async (req, res) => {
    const store = ((req as any).auth as AuthContext).store;
    await store.removeConfig(req.params.key);
    ok(res, {});
  });

  app.use(API_PREFIX, router);

  const server = app.listen(PORT, () => {
    console.log(`DataStore API listening on http://localhost:${PORT}${API_PREFIX}`);
  });
  server.on("error", (err) => {
    console.error("DataStore API failed to start:", err);
    process.exit(1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
