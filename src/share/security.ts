import {
  ShareCookiePayload,
  ShareRateLimitBucketState,
  ShareRateLimitDecision,
  ShareRateLimitRule,
  ShareSanitizeResult,
  ShareSanitizeStats,
} from "./types";

const SHARE_ACCESS_COOKIE_NAME = "plainly_share_access";

export const SHARE_PASSWORD_HASH_ALGO = "pbkdf2-sha256" as const;
export const SHARE_PASSWORD_HASH_ITERATIONS = 10000;
export const SHARE_PASSWORD_SALT_BYTES = 16;
export const SHARE_ACCESS_COOKIE_PURPOSE = "share-access" as const;
export const SHARE_ACCESS_COOKIE_TTL_SECONDS = 24 * 60 * 60;

export const SHARE_ALLOWED_TAGS = new Set([
  "a",
  "article",
  "aside",
  "blockquote",
  "br",
  "code",
  "del",
  "div",
  "em",
  "figcaption",
  "figure",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "i",
  "img",
  "li",
  "ol",
  "p",
  "pre",
  "section",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
]);

export const SHARE_REMOVE_WITH_CONTENT_TAGS = new Set([
  "iframe",
  "math",
  "noscript",
  "object",
  "script",
  "style",
  "svg",
  "template",
]);

export const SHARE_GLOBAL_ATTRIBUTES = new Set(["aria-hidden", "aria-label", "class", "dir", "id", "lang", "role", "title"]);

export const SHARE_TAG_ATTRIBUTES = {
  a: new Set(["href", "rel", "target"]),
  img: new Set(["alt", "height", "src", "title", "width"]),
  td: new Set(["align", "colspan", "rowspan"]),
  th: new Set(["align", "colspan", "rowspan", "scope"]),
} as const;

export const SHARE_PASSWORD_RATE_LIMIT_RULES: Record<"share_ip" | "share" | "ip", ShareRateLimitRule> = {
  share_ip: {
    scope: "share_ip",
    threshold: 10,
    windowMs: 60 * 1000,
    blockMs: 10 * 60 * 1000,
  },
  share: {
    scope: "share",
    threshold: 40,
    windowMs: 60 * 1000,
    blockMs: 10 * 60 * 1000,
  },
  ip: {
    scope: "ip",
    threshold: 80,
    windowMs: 60 * 1000,
    blockMs: 10 * 60 * 1000,
  },
};

const getWebCrypto = () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle || !globalThis.crypto.getRandomValues) {
    throw new Error("当前运行时不支持 WebCrypto");
  }
  return globalThis.crypto;
};

const encodeUtf8 = (value: string): Uint8Array => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "utf8"));
  }
  throw new Error("当前运行时不支持 UTF-8 编码");
};

const decodeUtf8 = (value: Uint8Array): string => {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder().decode(value);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value).toString("utf8");
  }
  throw new Error("当前运行时不支持 UTF-8 解码");
};

const asBufferSource = (value: Uint8Array): BufferSource => value as unknown as BufferSource;

const bytesToBase64 = (bytes: Uint8Array): string => {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
};

const base64ToBytes = (value: string): Uint8Array => {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "base64"));
  }
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

const bytesToBase64Url = (bytes: Uint8Array): string =>
  bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

const base64UrlToBytes = (value: string): Uint8Array => {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const remainder = padded.length % 4;
  const normalized = remainder === 0 ? padded : padded + "=".repeat(4 - remainder);
  return base64ToBytes(normalized);
};

const decodeBase64UrlJson = <T>(value: string): T => {
  const raw = decodeUtf8(base64UrlToBytes(value));
  return JSON.parse(raw) as T;
};

const timingSafeEqual = (left: string, right: string): boolean => {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) {
    diff += Math.abs(left.charCodeAt(i) - right.charCodeAt(i));
  }
  return diff === 0;
};

const hmacSha256 = async (secret: string, message: string): Promise<Uint8Array> => {
  const runtimeCrypto = getWebCrypto();
  const key = await runtimeCrypto.subtle.importKey(
    "raw",
    asBufferSource(encodeUtf8(secret)),
    {name: "HMAC", hash: "SHA-256"},
    false,
    ["sign"],
  );
  const signature = await runtimeCrypto.subtle.sign("HMAC", key, asBufferSource(encodeUtf8(message)));
  return new Uint8Array(signature);
};

export const createEmptyShareSanitizeStats = (): ShareSanitizeStats => ({
  removedNodes: 0,
  unwrappedNodes: 0,
  removedAttrs: 0,
  blockedUrls: 0,
  removedComments: 0,
});

export const isAllowedShareHref = (value: string): boolean => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("#")) return true;
  if (normalized.startsWith("/")) return true;
  if (normalized.startsWith("./") || normalized.startsWith("../")) return true;
  return /^(https?):/i.test(normalized);
};

export const isAllowedShareImageSrc = (value: string): boolean => {
  const normalized = String(value || "").trim();
  if (!normalized) return false;
  if (normalized.startsWith("/")) return true;
  if (normalized.startsWith("./") || normalized.startsWith("../")) return true;
  if (/^(https?):/i.test(normalized)) return true;
  return /^data:image\/(?:png|gif|jpe?g|webp);base64,/i.test(normalized);
};

export const normalizeShareUrlAttribute = (tagName: string, attrName: string, value: string): string | null => {
  const normalizedTagName = String(tagName || "").toLowerCase();
  const normalizedAttrName = String(attrName || "").toLowerCase();
  const normalizedValue = String(value || "").trim();
  if (normalizedAttrName === "href") {
    return isAllowedShareHref(normalizedValue) ? normalizedValue : null;
  }
  if (normalizedTagName === "img" && normalizedAttrName === "src") {
    return isAllowedShareImageSrc(normalizedValue) ? normalizedValue : null;
  }
  return normalizedValue;
};

export const mergeShareAnchorRel = (rawRel: string | null | undefined): string => {
  const parts = new Set(
    String(rawRel || "")
      .split(/\s+/)
      .map((item) => item.trim())
      .filter(Boolean),
  );
  parts.add("nofollow");
  parts.add("noopener");
  parts.add("noreferrer");
  return Array.from(parts).join(" ");
};

const escapeHtmlAttribute = (value: string): string =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const parseHtmlAttributes = (raw: string): Array<{name: string; value: string}> => {
  const attrs: Array<{name: string; value: string}> = [];
  const attrRegex = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (let match = attrRegex.exec(raw); match; match = attrRegex.exec(raw)) {
    const name = String(match[1] || "").trim();
    if (!name) continue;
    attrs.push({
      name,
      value: match[2] ?? match[3] ?? match[4] ?? "",
    });
  }
  return attrs;
};

export const SHARE_ALLOWED_STYLE_PROPERTIES = new Set([
  "background",
  "background-color",
  "border",
  "border-bottom",
  "border-color",
  "border-left",
  "border-radius",
  "border-right",
  "border-style",
  "border-top",
  "border-width",
  "clear",
  "color",
  "display",
  "fill",
  "float",
  "font-family",
  "font-size",
  "font-style",
  "font-weight",
  "height",
  "letter-spacing",
  "line-height",
  "list-style-type",
  "margin",
  "margin-bottom",
  "margin-left",
  "margin-right",
  "margin-top",
  "max-height",
  "max-width",
  "min-height",
  "min-width",
  "overflow",
  "overflow-wrap",
  "padding",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "padding-top",
  "stroke",
  "text-align",
  "text-decoration",
  "text-indent",
  "vertical-align",
  "white-space",
  "width",
  "word-break",
  "word-wrap",
]);

const hasUnsafeStyleValue = (value: string): boolean =>
  /expression\s*\(|url\s*\(|javascript:|vbscript:|data:|@import|behavior\s*:|<\/?style/i.test(value);

export const sanitizeShareInlineStyle = (value: string): string | null => {
  const declarations = String(value || "")
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean);
  const safeDeclarations: string[] = [];

  for (const declaration of declarations) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex <= 0) {
      continue;
    }
    const propertyName = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const propertyValue = declaration.slice(separatorIndex + 1).trim();
    if (!propertyName || !propertyValue) {
      continue;
    }
    if (!SHARE_ALLOWED_STYLE_PROPERTIES.has(propertyName)) {
      continue;
    }
    if (hasUnsafeStyleValue(propertyValue)) {
      continue;
    }
    if (/[<>`]/.test(propertyValue)) {
      continue;
    }
    safeDeclarations.push(`${propertyName}: ${propertyValue}`);
  }

  return safeDeclarations.length > 0 ? safeDeclarations.join("; ") : null;
};

export const sanitizeShareHtmlByStringRules = async (html: string): Promise<ShareSanitizeResult> => {
  const stats = createEmptyShareSanitizeStats();
  let sanitized = String(html || "");

  const commentMatches = sanitized.match(/<!--[\s\S]*?-->/g);
  if (commentMatches) {
    stats.removedComments += commentMatches.length;
    sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, "");
  }

  const removeBlockTagPattern = Array.from(SHARE_REMOVE_WITH_CONTENT_TAGS).join("|");
  const blockRegex = new RegExp(`<(${removeBlockTagPattern})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, "gi");
  const singleRegex = new RegExp(`<(${removeBlockTagPattern})\\b[^>]*\\/?>`, "gi");
  sanitized = sanitized.replace(blockRegex, () => {
    stats.removedNodes += 1;
    return "";
  });
  sanitized = sanitized.replace(singleRegex, () => {
    stats.removedNodes += 1;
    return "";
  });

  const tagRegex = /<\/?([a-zA-Z0-9:-]+)\b([^>]*)>/g;
  let output = "";
  let lastIndex = 0;

  for (let match = tagRegex.exec(sanitized); match; match = tagRegex.exec(sanitized)) {
    output += sanitized.slice(lastIndex, match.index);
    lastIndex = tagRegex.lastIndex;

    const rawTag = match[0];
    const tagName = String(match[1] || "").toLowerCase();
    const attrSource = match[2] || "";
    const isClosing = rawTag.startsWith("</");
    const isSelfClosing = /\/>$/.test(rawTag) || tagName === "img" || tagName === "br" || tagName === "hr";

    if (!SHARE_ALLOWED_TAGS.has(tagName)) {
      stats.unwrappedNodes += 1;
      continue;
    }

    if (isClosing) {
      output += `</${tagName}>`;
      continue;
    }

    const allowedAttrs = new Set([
      ...SHARE_GLOBAL_ATTRIBUTES,
      ...Array.from(SHARE_TAG_ATTRIBUTES[tagName as keyof typeof SHARE_TAG_ATTRIBUTES] || []),
    ]);
    const normalizedAttrs: string[] = [];
    let dropWholeTag = false;
    let anchorTarget = "";
    let anchorRel = "";

    for (const attr of parseHtmlAttributes(attrSource)) {
      const attrName = String(attr.name || "").toLowerCase();
      let attrValue = String(attr.value || "");

      if (attrName.startsWith("on")) {
        stats.removedAttrs += 1;
        continue;
      }
      if (attrName === "style") {
        const safeStyle = sanitizeShareInlineStyle(attrValue);
        if (!safeStyle) {
          stats.removedAttrs += 1;
          continue;
        }
        normalizedAttrs.push(`style="${escapeHtmlAttribute(safeStyle)}"`);
        continue;
      }
      if (!allowedAttrs.has(attrName)) {
        stats.removedAttrs += 1;
        continue;
      }
      if (attrName === "href" || attrName === "src") {
        const safeValue = normalizeShareUrlAttribute(tagName, attrName, attrValue);
        if (!safeValue) {
          stats.blockedUrls += 1;
          if (tagName === "img" && attrName === "src") {
            dropWholeTag = true;
            stats.removedNodes += 1;
            break;
          }
          stats.removedAttrs += 1;
          continue;
        }
        attrValue = safeValue;
      }
      if (tagName === "a" && attrName === "target") {
        if (attrValue !== "_blank" && attrValue !== "_self") {
          stats.removedAttrs += 1;
          continue;
        }
        anchorTarget = attrValue;
      }
      if (tagName === "a" && attrName === "rel") {
        anchorRel = attrValue;
      }
      normalizedAttrs.push(`${attrName}="${escapeHtmlAttribute(attrValue)}"`);
    }

    if (dropWholeTag) {
      continue;
    }
    if (tagName === "a" && anchorTarget === "_blank") {
      normalizedAttrs.push(`rel="${escapeHtmlAttribute(mergeShareAnchorRel(anchorRel))}"`);
    }

    output += `<${tagName}${normalizedAttrs.length ? ` ${normalizedAttrs.join(" ")}` : ""}${isSelfClosing ? ">" : ">"}`;
  }

  output += sanitized.slice(lastIndex);
  return {
    html: output,
    stats,
  };
};

export const sanitizeShareHtml = async (
  html: string,
  runner: (input: string) => Promise<ShareSanitizeResult>,
): Promise<ShareSanitizeResult> => runner(String(html || ""));

export const hashSharePassword = async (
  password: string,
  saltBase64?: string | null,
): Promise<{hash: string; salt: string; algo: typeof SHARE_PASSWORD_HASH_ALGO; iterations: number}> => {
  const runtimeCrypto = getWebCrypto();
  const salt = saltBase64
    ? base64ToBytes(String(saltBase64))
    : runtimeCrypto.getRandomValues(new Uint8Array(SHARE_PASSWORD_SALT_BYTES));
  const key = await runtimeCrypto.subtle.importKey(
    "raw",
    asBufferSource(encodeUtf8(password)),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const derivedBits = await runtimeCrypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      iterations: SHARE_PASSWORD_HASH_ITERATIONS,
      salt: asBufferSource(salt),
    },
    key,
    256,
  );
  return {
    hash: bytesToBase64(new Uint8Array(derivedBits)),
    salt: bytesToBase64(salt),
    algo: SHARE_PASSWORD_HASH_ALGO,
    iterations: SHARE_PASSWORD_HASH_ITERATIONS,
  };
};

export const verifySharePassword = async (
  password: string,
  expectedHash: string,
  saltBase64: string,
): Promise<boolean> => {
  const derived = await hashSharePassword(password, saltBase64);
  return timingSafeEqual(derived.hash, expectedHash);
};

export const signShareAccessToken = async (
  payload: Omit<ShareCookiePayload, "iat" | "exp" | "purpose"> & Partial<Pick<ShareCookiePayload, "iat" | "exp" | "purpose">>,
  secret: string,
  ttlSec: number = SHARE_ACCESS_COOKIE_TTL_SECONDS,
  nowMs: number = Date.now(),
): Promise<string> => {
  const nowSec = Math.floor(nowMs / 1000);
  const body: ShareCookiePayload = {
    shareId: payload.shareId,
    passwordVersion: payload.passwordVersion,
    kid: payload.kid ?? null,
    iat: payload.iat ?? nowSec,
    exp: payload.exp ?? nowSec + ttlSec,
    purpose: payload.purpose ?? SHARE_ACCESS_COOKIE_PURPOSE,
  };
  const header = {
    alg: "HS256",
    typ: "SAT",
  };
  const headerB64 = bytesToBase64Url(encodeUtf8(JSON.stringify(header)));
  const payloadB64 = bytesToBase64Url(encodeUtf8(JSON.stringify(body)));
  const data = `${headerB64}.${payloadB64}`;
  const signature = await hmacSha256(secret, data);
  return `${data}.${bytesToBase64Url(signature)}`;
};

export const verifyShareAccessToken = async (
  token: string,
  secret: string,
  nowMs: number = Date.now(),
): Promise<ShareCookiePayload> => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) {
    throw new Error("invalid share access token");
  }
  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{alg?: string; typ?: string}>(headerB64);
  if (header.alg !== "HS256" || header.typ !== "SAT") {
    throw new Error("invalid share access token");
  }
  const data = `${headerB64}.${payloadB64}`;
  const expectedSignature = bytesToBase64Url(await hmacSha256(secret, data));
  if (!timingSafeEqual(signatureB64, expectedSignature)) {
    throw new Error("invalid share access token");
  }
  const payload = decodeBase64UrlJson<ShareCookiePayload>(payloadB64);
  if (payload.purpose !== SHARE_ACCESS_COOKIE_PURPOSE) {
    throw new Error("invalid share access token");
  }
  if (Math.floor(nowMs / 1000) > payload.exp) {
    throw new Error("share access token expired");
  }
  return payload;
};

export const getShareAccessCookieName = (): string => SHARE_ACCESS_COOKIE_NAME;

export const getShareAccessCookiePath = (shareId: string): string => `/read/${encodeURIComponent(String(shareId || "").trim())}`;

export const buildShareAccessCookie = (
  token: string,
  shareId: string,
  options?: {
    maxAgeSec?: number;
    secure?: boolean;
    sameSite?: "Lax" | "Strict" | "None";
    httpOnly?: boolean;
  },
): string => {
  const parts = [`${SHARE_ACCESS_COOKIE_NAME}=${encodeURIComponent(token)}`];
  parts.push(`Path=${getShareAccessCookiePath(shareId)}`);
  parts.push(`Max-Age=${options?.maxAgeSec ?? SHARE_ACCESS_COOKIE_TTL_SECONDS}`);
  parts.push(`SameSite=${options?.sameSite ?? "Lax"}`);
  if (options?.httpOnly !== false) parts.push("HttpOnly");
  if (options?.secure !== false) parts.push("Secure");
  return parts.join("; ");
};

export const buildExpiredShareAccessCookie = (shareId: string): string =>
  `${SHARE_ACCESS_COOKIE_NAME}=; Path=${getShareAccessCookiePath(shareId)}; Max-Age=0; SameSite=Lax; HttpOnly; Secure`;

export const buildSharePasswordRateLimitKeys = (shareId: string, ip: string) => {
  const normalizedShareId = String(shareId || "").trim();
  const normalizedIp = String(ip || "").trim() || "unknown";
  return {
    shareIp: `share:${normalizedShareId}:ip:${normalizedIp}`,
    share: `share:${normalizedShareId}`,
    ip: `ip:${normalizedIp}`,
  };
};

export const evaluateShareRateLimit = (
  state: ShareRateLimitBucketState,
  rule: ShareRateLimitRule,
  nowMs: number = Date.now(),
): ShareRateLimitDecision => {
  const blockedUntil = state.blockedUntil ?? null;
  if (blockedUntil != null && blockedUntil > nowMs) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((blockedUntil - nowMs) / 1000)),
      blockedUntil,
    };
  }
  const windowStartedAt = state.windowStartedAt ?? nowMs;
  const failures = nowMs - windowStartedAt >= rule.windowMs ? 0 : state.failures;
  if (failures >= rule.threshold) {
    const nextBlockedUntil = nowMs + rule.blockMs;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(rule.blockMs / 1000)),
      blockedUntil: nextBlockedUntil,
    };
  }
  return {
    allowed: true,
    retryAfterSec: 0,
    blockedUntil: null,
  };
};

export const recordShareRateLimitFailure = (
  state: ShareRateLimitBucketState,
  rule: ShareRateLimitRule,
  nowMs: number = Date.now(),
): {nextState: ShareRateLimitBucketState; decision: ShareRateLimitDecision} => {
  const windowStartedAt = state.windowStartedAt ?? nowMs;
  const inWindow = nowMs - windowStartedAt < rule.windowMs;
  const failures = inWindow ? state.failures + 1 : 1;
  const nextState: ShareRateLimitBucketState = {
    failures,
    windowStartedAt: inWindow ? windowStartedAt : nowMs,
    blockedUntil: state.blockedUntil ?? null,
  };
  const decision = evaluateShareRateLimit(nextState, rule, nowMs);
  if (!decision.allowed) {
    nextState.blockedUntil = decision.blockedUntil;
  }
  return {
    nextState,
    decision,
  };
};
