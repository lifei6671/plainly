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
import {filterRemoteConfigKeys, isRemoteConfigKeyAllowed} from "../utils/remoteConfigWhitelist";
import {
  SHARE_ACCESS_COOKIE_TTL_SECONDS,
  SHARE_CDN_LONG_CACHE_CONTROL,
  SHARE_CDN_SHORT_CACHE_CONTROL,
  SHARE_LIST_CACHE_CONTROL,
  SHARE_LIST_CDN_CACHE_CONTROL,
  SHARE_LIST_VARIANT_CACHE_CONTROL,
  SHARE_LIST_VARIANT_CDN_CACHE_CONTROL,
  SHARE_PAGE_BROWSER_CACHE_CONTROL,
  SHARE_PASSWORD_RATE_LIMIT_RULES,
  SHARE_PRIVATE_CACHE_CONTROL,
  SHARE_READ_CSP,
  SHARE_REFERRER_POLICY,
  UpdateDocumentSettingsInput,
  UpdateShareSnapshotInput,
  buildShareAccessCookie,
  buildShareCachePurgeUrls,
  buildShareContentPayload,
  collectShareCachePathsForSettingsChange,
  collectShareCachePathsForSnapshotUpdate,
  createCloudflareShareCachePurger,
  shouldCacheShareListVariant,
  buildExpiredShareAccessCookie,
  buildDocumentSettingsPayload,
  buildMetaUpdateInput,
  buildShareSaveInput,
  ShareCachePurger,
  evaluateShareAccess,
  evaluateShareRateLimit,
  getShareAccessCookieName,
  hashSharePassword,
  normalizeShareAssetId,
  normalizeShareListPageParams,
  recordShareRateLimitFailure,
  renderShareDocumentPage,
  renderShareListPage,
  renderSharePasswordPage,
  renderShareStatusPage,
  shouldUseLongShareCdnCache,
  signShareAccessToken,
  verifyShareAccessToken,
  verifySharePassword,
  buildSharePasswordRateLimitKeys,
} from "../share";

if (!(globalThis as any).crypto?.subtle && (crypto as any).webcrypto) {
  (globalThis as any).crypto = (crypto as any).webcrypto;
}

type ServerConfig = {
  port?: number;
  apiPrefix?: string;
  dbFile?: string;
};

type CreateServerAppOptions = {
  storeFactory: NodeDataStore;
  apiPrefix?: string;
  shareCachePurger?: ShareCachePurger | null;
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

const shareAccessSecret = process.env.SHARE_ACCESS_SECRET || JWT_SECRET;
const sharePasswordRateLimitState = new Map<string, {failures: number; windowStartedAt?: number | null; blockedUntil?: number | null}>();

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

const authRequired = (storeFactory: NodeDataStore) => async (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) => {
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
    if (pwdChangedMs && decoded.iat && decoded.iat * 1000 + 999 < pwdChangedMs) {
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

const ensureRemoteConfigKeyAllowed = (key: string) => isRemoteConfigKeyAllowed(key);

const getForwardedHeader = (value: string | string[] | undefined): string | null => {
  if (typeof value === "string" && value.trim()) {
    return value.split(",")[0].trim();
  }
  if (Array.isArray(value) && value.length > 0) {
    return getForwardedHeader(value[0]);
  }
  return null;
};

const buildRequestOrigin = (req: express.Request): string => {
  const forwardedProto = getForwardedHeader(req.headers["x-forwarded-proto"]);
  const forwardedHost = getForwardedHeader(req.headers["x-forwarded-host"]);
  const protocol = forwardedProto || req.protocol || "http";
  const host = forwardedHost || req.get("host") || "localhost";
  return `${protocol}://${host}`;
};

const generateShareId = () =>
  crypto
    .randomBytes(16)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const parseBearer = (req: express.Request): string | null => {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;
  const parts = header.split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];
  return null;
};

const applyShareSecurityHeaders = (res: express.Response) => {
  res.setHeader("Content-Security-Policy", SHARE_READ_CSP);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", SHARE_REFERRER_POLICY);
};

const setShareListCacheHeaders = (
  res: express.Response,
  options?: {cacheableVariant?: boolean},
) => {
  const cacheableVariant = options?.cacheableVariant !== false;
  res.setHeader("Cache-Control", cacheableVariant ? SHARE_LIST_CACHE_CONTROL : SHARE_LIST_VARIANT_CACHE_CONTROL);
  res.setHeader(
    "CDN-Cache-Control",
    cacheableVariant ? SHARE_LIST_CDN_CACHE_CONTROL : SHARE_LIST_VARIANT_CDN_CACHE_CONTROL,
  );
};

const setSharePrivateCacheHeaders = (res: express.Response) => {
  res.setHeader("Cache-Control", SHARE_PRIVATE_CACHE_CONTROL);
  res.setHeader("CDN-Cache-Control", "no-store");
};

const setSharePageCacheHeaders = (res: express.Response, lastModifiedAt?: number | null) => {
  res.setHeader("Cache-Control", SHARE_PAGE_BROWSER_CACHE_CONTROL);
  res.setHeader(
    "CDN-Cache-Control",
    shouldUseLongShareCdnCache(lastModifiedAt ?? null) ? SHARE_CDN_LONG_CACHE_CONTROL : SHARE_CDN_SHORT_CACHE_CONTROL,
  );
};

const getShareErrorMessage = (value: unknown): string | null => {
  if (value === "password") return "密码错误，请重试。";
  if (value === "expired") return "访问凭证已过期，请重新输入密码。";
  return null;
};

const getShareClientIp = (req: express.Request): string => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    return String(forwarded[0] || "").split(",")[0].trim() || req.ip || "unknown";
  }
  return req.ip || req.socket.remoteAddress || "unknown";
};

const getSharePasswordGrant = async (req: express.Request, share: {shareId: string; passwordVersion?: number | null}) => {
  const token = (req as any).cookies ? (req as any).cookies[getShareAccessCookieName()] : null;
  if (!token || typeof token !== "string") return false;
  try {
    const payload = await verifyShareAccessToken(token, shareAccessSecret);
    return payload.shareId === share.shareId && payload.passwordVersion === (share.passwordVersion ?? 0);
  } catch (_error) {
    return false;
  }
};

const sendShareHtml = (res: express.Response, status: number, html: string) => {
  res.status(status);
  res.type("html");
  res.send(html);
};

const resolveLocalAssetFile = (assetId: string, roots: string[]): string | null => {
  const normalized = String(assetId || "").replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized) return null;
  for (const root of roots) {
    const absoluteRoot = path.resolve(root);
    const candidate = path.resolve(absoluteRoot, normalized);
    if (!candidate.toLowerCase().startsWith(absoluteRoot.toLowerCase())) {
      continue;
    }
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }
  return null;
};

const checkShareRateLimit = (shareId: string, ip: string, nowMs: number = Date.now()) => {
  const keys = buildSharePasswordRateLimitKeys(shareId, ip);
  const buckets = [
    {mapKey: keys.shareIp, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.share_ip},
    {mapKey: keys.share, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.share},
    {mapKey: keys.ip, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.ip},
  ];
  for (const bucket of buckets) {
    const decision = evaluateShareRateLimit(sharePasswordRateLimitState.get(bucket.mapKey) || {failures: 0}, bucket.rule, nowMs);
    if (!decision.allowed) {
      return decision;
    }
  }
  return {allowed: true, retryAfterSec: 0, blockedUntil: null};
};

const recordShareAccessFailure = (shareId: string, ip: string, nowMs: number = Date.now()) => {
  const keys = buildSharePasswordRateLimitKeys(shareId, ip);
  const buckets = [
    {mapKey: keys.shareIp, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.share_ip},
    {mapKey: keys.share, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.share},
    {mapKey: keys.ip, rule: SHARE_PASSWORD_RATE_LIMIT_RULES.ip},
  ];
  let retryAfterSec = 0;
  for (const bucket of buckets) {
    const currentState = sharePasswordRateLimitState.get(bucket.mapKey) || {failures: 0};
    const {nextState, decision} = recordShareRateLimitFailure(currentState, bucket.rule, nowMs);
    sharePasswordRateLimitState.set(bucket.mapKey, nextState);
    retryAfterSec = Math.max(retryAfterSec, decision.retryAfterSec);
  }
  return retryAfterSec;
};

export function createServerApp(options: CreateServerAppOptions): express.Express {
  const {storeFactory} = options;
  const apiPrefix = options.apiPrefix || API_PREFIX;
  const shareCachePurger = options.shareCachePurger || null;
  const app = express();
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(bodyParser.json({limit: "10mb"}));
  app.use(bodyParser.urlencoded({extended: false}));
  app.use(cookieParser());

  const purgeShareCache = async (origin: string, paths: string[]) => {
    if (!shareCachePurger) return;
    const urls = buildShareCachePurgeUrls(origin, paths);
    if (!urls.length) return;
    try {
      await shareCachePurger.purgeByUrls(urls);
    } catch (error) {
      console.warn("share cache purge failed:", error);
    }
  };

  const router = express.Router();

  // auth
  router.post("/auth/register", async (req, res) => {
    const {account, password} = req.body || {};
    if (!account || !password) return fail(res, "account and password required", 400);
    try {
      const user = storeFactory.createUser(String(account).trim(), String(password));
      await storeFactory.forUser(user.id).listCategories();
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
    } catch (e) {
      fail(res, e?.message || "register failed");
    }
  });

  router.post("/auth/login", async (req, res) => {
    const {account, password} = req.body || {};
    if (!account || !password) return fail(res, "account and password required");
    const user = storeFactory.verifyUser(String(account).trim(), String(password));
    if (!user) return fail(res, "用户名或密码错误", 401);
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
    } catch (e) {
      fail(res, e?.message || "update password failed");
    }
  });

  // 用户必需
  router.use(authRequired(storeFactory));

  // categories
  router.get("/categories", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.listCategories());
  });
  router.get("/categories/count", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.listCategoriesWithCount());
  });
  router.post("/categories", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const {name, category_id, source, version} = req.body || {};
    if (!name) return fail(res, "name required");
    ok(res, await store.createCategory(name, {category_id, source, version}));
  });
  router.post("/categories/batch", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
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
      } catch (e) {
        results.push({client_id: item.category_id, error: e?.message || "create failed"});
      }
    }
    ok(res, {items: results});
  });
  router.patch("/categories/:id", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    await store.renameCategory(String(req.params.id), req.body?.name);
    ok(res, {});
  });
  router.delete("/categories/:id", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const reassignTo = req.query.reassignTo ? String(req.query.reassignTo) : undefined;
    await store.deleteCategory(String(req.params.id), {reassignTo});
    ok(res, {});
  });

  // documents
  router.get("/documents", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const offset = Number(req.query.offset || 0);
    const limit = Number(req.query.limit || 20);
    ok(res, await store.listDocumentsPage(offset, limit));
  });
  router.get("/documents/all", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.listAllDocuments());
  });
  router.post("/documents/search", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
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
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.getDocumentMeta(String(req.params.id)));
  });
  router.get("/documents/:id/rename", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.getRenameData(String(req.params.id)));
  });
  router.patch("/documents/:id/meta", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    await store.updateDocumentMeta(String(req.params.id), req.body as UpdateDocumentMetaInput);
    ok(res, {});
  });
  router.post("/documents", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const {meta, content} = req.body || {};
    if (!meta || typeof content !== "string") return fail(res, "invalid payload");
    const created = await store.createDocument(meta, content);
    ok(res, created);
  });
  router.post("/documents/batch", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
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
      } catch (e) {
        results.push({client_id: item.meta?.document_id, error: e?.message || "create failed"});
      }
    }
    ok(res, {items: results});
  });
  router.get("/documents/:id/content", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    ok(res, await store.getDocumentContent(String(req.params.id)));
  });
  router.put("/documents/:id/content", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const {content, updatedAt} = req.body || {};
    if (typeof content !== "string") return fail(res, "content required");
    await store.saveDocumentContent(String(req.params.id), content, updatedAt);
    ok(res, {});
  });
  router.delete("/documents/:id", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    await store.deleteDocument(String(req.params.id));
    ok(res, {});
  });
  router.post("/documents/:id/charcount", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const meta = req.body;
    ok(res, await store.ensureDocumentCharCount(meta));
  });
  router.get("/documents/:id/settings", async (req, res) => {
    try {
      const {store} = (req as any).auth as AuthContext;
      const documentId = String(req.params.id);
      const [meta, categories, share] = await Promise.all([
        store.getDocumentMeta(documentId),
        store.listCategories(),
        store.getDocumentShare(documentId),
      ]);
      ok(
        res,
        buildDocumentSettingsPayload({
          meta,
          categories,
          share,
          origin: buildRequestOrigin(req),
        }),
      );
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "get document settings failed", 400);
    }
  });
  router.put("/documents/:id/settings", async (req, res) => {
    try {
      const {store} = (req as any).auth as AuthContext;
      const documentId = String(req.params.id);
      const body = (req.body || {}) as UpdateDocumentSettingsInput;
      const metaUpdates = buildMetaUpdateInput(body.meta);
      const existingMeta = await store.getDocumentMeta(documentId);
      if (!existingMeta) {
        return fail(res, "document not found", 404);
      }
      if (metaUpdates) {
        await store.updateDocumentMeta(documentId, metaUpdates as UpdateDocumentMetaInput);
      }
      if (body.share) {
        const existingShare = await store.getDocumentShare(documentId);
        const saveInput = await buildShareSaveInput({
          existingShare,
          documentId,
          shareInput: body.share,
          generateShareId,
          hashPassword: (password) => hashSharePassword(password),
        });
        await store.saveDocumentShare(saveInput);
        const nextShare = await store.getDocumentShare(documentId);
        await purgeShareCache(
          buildRequestOrigin(req),
          collectShareCachePathsForSettingsChange({
            previousShare: existingShare,
            nextShare,
          }),
        );
      }
      const [meta, categories, share] = await Promise.all([
        store.getDocumentMeta(documentId),
        store.listCategories(),
        store.getDocumentShare(documentId),
      ]);
      ok(
        res,
        buildDocumentSettingsPayload({
          meta,
          categories,
          share,
          origin: buildRequestOrigin(req),
        }),
      );
    } catch (error) {
      fail(res, error instanceof Error ? error.message : "update document settings failed", 400);
    }
  });
  router.put("/documents/:id/share/snapshot", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const documentId = String(req.params.id);
    const body = (req.body || {}) as UpdateShareSnapshotInput;
    try {
      const previousShare = await store.getDocumentShare(documentId);
      const result = await store.updateShareSnapshot(documentId, body);
      const nextShare = await store.getDocumentShare(documentId);
      await purgeShareCache(
        buildRequestOrigin(req),
        collectShareCachePathsForSnapshotUpdate({
          previousShare,
          nextShare,
          accepted: previousShare?.snapshotHash !== nextShare?.snapshotHash || previousShare?.snapshotVersion !== nextShare?.snapshotVersion,
        }),
      );
      return ok(res, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "invalid snapshot payload";
      if (message.includes("conflict")) {
        return fail(res, message, 409);
      }
      if (message.includes("exceeds max size")) {
        return fail(res, message, 413);
      }
      return fail(res, message, 400);
    }
  });

  // config
  router.get("/config", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    const prefix = req.query.prefix ? String(req.query.prefix) : undefined;
    ok(res, filterRemoteConfigKeys(await store.listConfigKeys(prefix)));
  });
  router.get("/config/:key", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    if (!ensureRemoteConfigKeyAllowed(req.params.key)) {
      return fail(res, `unsupported config key: ${req.params.key}`);
    }
    const fallback = req.query.fallback ? JSON.parse(String(req.query.fallback)) : undefined;
    return ok(res, await store.getConfig(req.params.key, fallback));
  });
  router.put("/config/:key", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    if (!ensureRemoteConfigKeyAllowed(req.params.key)) {
      return fail(res, `unsupported config key: ${req.params.key}`);
    }
    await store.setConfig(req.params.key, req.body?.value);
    return ok(res, {});
  });
  router.delete("/config/:key", async (req, res) => {
    const {store} = (req as any).auth as AuthContext;
    if (!ensureRemoteConfigKeyAllowed(req.params.key)) {
      return fail(res, `unsupported config key: ${req.params.key}`);
    }
    await store.removeConfig(req.params.key);
    return ok(res, {});
  });

  app.use(apiPrefix, router);

  app.get("/read", async (req, res) => {
    applyShareSecurityHeaders(res);
    const {page, pageSize} = normalizeShareListPageParams({
      page: req.query.page,
      pageSize: req.query.pageSize,
    });
    setShareListCacheHeaders(res, {
      cacheableVariant: shouldCacheShareListVariant({
        page,
        pageSize,
        hasExplicitPageParam: Object.prototype.hasOwnProperty.call(req.query, "page"),
        hasExplicitPageSizeParam: Object.prototype.hasOwnProperty.call(req.query, "pageSize"),
      }),
    });
    const data = await storeFactory.listPublicDocumentShares(page, pageSize, Date.now());
    return sendShareHtml(res, 200, renderShareListPage(data));
  });

  app.get("/read/:shareId", async (req, res) => {
    applyShareSecurityHeaders(res);
    const shareId = String(req.params.shareId || "").trim();
    const context = await storeFactory.getPublicDocumentShare(shareId);
    if (!context) {
      setSharePrivateCacheHeaders(res);
      return sendShareHtml(
        res,
        404,
        renderShareStatusPage({
          title: "公开链接不存在",
          message: "这个公开链接不存在，或者已经被移除。",
        }),
      );
    }

    const hasPasswordGrant = await getSharePasswordGrant(req, context.share);
    const decision = evaluateShareAccess({
      share: context.share,
      mode: "remote",
      target: "page",
      now: Date.now(),
      hasPasswordGrant,
    });
    if (decision.code !== "allow") {
      setSharePrivateCacheHeaders(res);
      return sendShareHtml(
        res,
        decision.httpStatus,
        renderShareStatusPage({
          title: decision.httpStatus === 410 ? "公开链接已失效" : "当前无法访问",
          message:
            decision.reason === "not_started"
              ? "这篇文档尚未到开放阅读时间。"
              : decision.reason === "expired"
                ? "这篇文档的公开时间已结束。"
                : "当前公开链接不可访问。",
        }),
      );
    }

    if (decision.pageKind === "password") {
      setSharePrivateCacheHeaders(res);
      return sendShareHtml(
        res,
        200,
        renderSharePasswordPage({
          share: context.share,
          meta: context.meta,
          errorMessage: getShareErrorMessage(req.query.error),
        }),
      );
    }

    if (!context.share.htmlSnapshot || context.share.snapshotVersion == null || !context.share.snapshotHash) {
      setSharePrivateCacheHeaders(res);
      return sendShareHtml(
        res,
        200,
        renderShareStatusPage({
          title: "公开内容准备中",
          message: "当前文档的公开快照尚未准备完成，请稍后再试。",
          robots: decision.robots,
        }),
      );
    }

    const lastModifiedAt = Number(context.meta.updatedAt || context.share.lastSnapshotAt || context.share.updatedAt || Date.now());
    if (decision.canRenderSsr) {
      setSharePageCacheHeaders(res, lastModifiedAt);
      return sendShareHtml(
        res,
        200,
        renderShareDocumentPage({
          share: context.share,
          meta: context.meta,
          robots: decision.robots,
        }),
      );
    }

    setSharePrivateCacheHeaders(res);
    return sendShareHtml(
      res,
      200,
      renderShareDocumentPage({
        share: context.share,
        meta: context.meta,
        robots: decision.robots,
        shellMode: true,
      }),
    );
  });

  app.post("/read/:shareId/access", async (req, res) => {
    applyShareSecurityHeaders(res);
    const shareId = String(req.params.shareId || "").trim();
    const context = await storeFactory.getPublicDocumentShare(shareId);
    if (!context) {
      setSharePrivateCacheHeaders(res);
      return sendShareHtml(
        res,
        404,
        renderShareStatusPage({
          title: "公开链接不存在",
          message: "这个公开链接不存在，或者已经被移除。",
        }),
      );
    }

    if (context.share.accessType !== "password") {
      return res.redirect(302, `/read/${encodeURIComponent(context.share.shareId)}`);
    }

    const ip = getShareClientIp(req);
    const limitDecision = checkShareRateLimit(context.share.shareId, ip);
    if (!limitDecision.allowed) {
      setSharePrivateCacheHeaders(res);
      res.setHeader("Retry-After", String(limitDecision.retryAfterSec));
      return sendShareHtml(
        res,
        429,
        renderShareStatusPage({
          title: "尝试过于频繁",
          message: "密码输入过于频繁，请稍后再试。",
        }),
      );
    }

    const password = typeof req.body?.password === "string" ? String(req.body.password) : "";
    const isValid =
      Boolean(password) &&
      Boolean(context.share.passwordHash) &&
      Boolean(context.share.passwordSalt) &&
      (await verifySharePassword(password, String(context.share.passwordHash), String(context.share.passwordSalt)));

    if (!isValid) {
      recordShareAccessFailure(context.share.shareId, ip);
      res.setHeader("Set-Cookie", buildExpiredShareAccessCookie(context.share.shareId));
      return res.redirect(302, `/read/${encodeURIComponent(context.share.shareId)}?error=password`);
    }

    const token = await signShareAccessToken(
      {
        shareId: context.share.shareId,
        passwordVersion: context.share.passwordVersion ?? 0,
      },
      shareAccessSecret,
      SHARE_ACCESS_COOKIE_TTL_SECONDS,
    );
    res.setHeader(
      "Set-Cookie",
      buildShareAccessCookie(token, context.share.shareId, {
        secure: isProd,
      }),
    );
    return res.redirect(302, `/read/${encodeURIComponent(context.share.shareId)}`);
  });

  app.get("/read/:shareId/content", async (req, res) => {
    const shareId = String(req.params.shareId || "").trim();
    const context = await storeFactory.getPublicDocumentShare(shareId);
    if (!context) {
      return fail(res, "share not found", 404);
    }
    const hasPasswordGrant = await getSharePasswordGrant(req, context.share);
    const decision = evaluateShareAccess({
      share: context.share,
      mode: "remote",
      target: "content",
      now: Date.now(),
      hasPasswordGrant,
    });
    if (decision.code !== "allow" || !decision.canAccessContent) {
      return fail(res, decision.reason, decision.httpStatus);
    }
    if (!context.share.htmlSnapshot || context.share.snapshotVersion == null || !context.share.snapshotHash) {
      return fail(res, "share snapshot unavailable", 404);
    }
    if (context.share.accessType === "password") {
      setSharePrivateCacheHeaders(res);
    } else {
      setSharePageCacheHeaders(res, Number(context.meta.updatedAt || context.share.lastSnapshotAt || context.share.updatedAt || Date.now()));
    }
    return ok(res, buildShareContentPayload(context.share, context.meta));
  });

  app.get("/read/:shareId/assets/:assetId", async (req, res) => {
    const shareId = String(req.params.shareId || "").trim();
    const assetId = normalizeShareAssetId(decodeURIComponent(String(req.params.assetId || "")));
    if (!assetId) {
      return res.status(404).end();
    }
    const context = await storeFactory.getPublicDocumentShare(shareId);
    if (!context) {
      return res.status(404).end();
    }
    const hasPasswordGrant = await getSharePasswordGrant(req, context.share);
    const decision = evaluateShareAccess({
      share: context.share,
      mode: "remote",
      target: "asset",
      now: Date.now(),
      hasPasswordGrant,
    });
    if (decision.code !== "allow" || !decision.canAccessAsset) {
      return res.status(decision.httpStatus).end();
    }
    const exists = await storeFactory.hasPublicDocumentShareAsset(context.share.shareId, assetId);
    if (!exists) {
      return res.status(404).end();
    }
    const assetFile = resolveLocalAssetFile(assetId, [storeFactory.getStorageRoot(), process.cwd()]);
    if (!assetFile) {
      return res.status(404).end();
    }
    if (context.share.accessType === "password") {
      setSharePrivateCacheHeaders(res);
    } else {
      setSharePageCacheHeaders(res, Number(context.meta.updatedAt || context.share.lastSnapshotAt || context.share.updatedAt || Date.now()));
    }
    return res.sendFile(assetFile);
  });

  return app;
}

async function main() {
  const storeFactory = new NodeDataStore(DB_FILE);
  await storeFactory.init();
  const app = createServerApp({
    storeFactory,
    apiPrefix: API_PREFIX,
    shareCachePurger: createCloudflareShareCachePurger({
      zoneId: process.env.CLOUDFLARE_ZONE_ID || process.env.CF_ZONE_ID,
      apiToken: process.env.CLOUDFLARE_API_TOKEN || process.env.CF_API_TOKEN,
    }),
  });
  const server = app.listen(PORT, () => {
    console.log(`DataStore API listening on http://localhost:${PORT}${API_PREFIX}`);
  });
  server.on("error", (err) => {
    console.error("DataStore API failed to start:", err);
    process.exit(1);
  });
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
