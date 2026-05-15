import {ShareSnapshotUpdateDecision, ShareSnapshotUpdateInput} from "./types";

const encodeUtf8 = (value: string): Uint8Array => {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value);
  }
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(value, "utf8"));
  }
  throw new Error("当前运行时不支持 UTF-8 编码");
};

const asBufferSource = (value: Uint8Array): BufferSource => value as unknown as BufferSource;

export const SHARE_HTML_SNAPSHOT_MAX_BYTES = 2 * 1024 * 1024;
export const SHARE_TITLE_SNAPSHOT_MAX_CHARS = 200;
export const SHARE_EXCERPT_SNAPSHOT_MAX_CHARS = 500;

const getWebCrypto = () => {
  if (!globalThis.crypto || !globalThis.crypto.subtle) {
    throw new Error("当前运行时不支持 WebCrypto");
  }
  return globalThis.crypto;
};

const bytesToHex = (bytes: Uint8Array) =>
  Array.from(bytes)
    .map((item) => item.toString(16).padStart(2, "0"))
    .join("");

const stripHtmlTags = (value: string): string => value.replace(/<[^>]*>/g, " ");

export const normalizeShareSnapshotText = (value: string | null | undefined, maxChars: number): string =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);

const SHARE_EXTERNAL_URL_RE = /^(?:[a-z][a-z0-9+.-]*:)?\/\//i;
const SHARE_BLOCKED_ASSET_SCHEMES = /^(?:data:|blob:|javascript:|mailto:|tel:)/i;

export const normalizeShareAssetId = (value: string | null | undefined): string | null => {
  const normalized = String(value || "")
    .trim()
    .replace(/\\/g, "/");
  if (!normalized) return null;
  if (SHARE_EXTERNAL_URL_RE.test(normalized)) return null;
  if (SHARE_BLOCKED_ASSET_SCHEMES.test(normalized)) return null;

  const withoutQuery = normalized.split("#")[0].split("?")[0] || normalized;
  const cleaned = withoutQuery
    .replace(/\/{2,}/g, "/")
    .replace(/^\.\//, "")
    .replace(/\/\.\//g, "/")
    .trim();
  if (!cleaned) return null;
  return cleaned;
};

export const extractShareAssetIdsFromHtml = (html: string): string[] => {
  const source = String(html || "");
  const matches = source.matchAll(/<img\b[^>]*\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi);
  const assetIds = new Set<string>();
  for (const match of matches) {
    const rawSrc = match[1] || match[2] || match[3] || "";
    const assetId = normalizeShareAssetId(rawSrc);
    if (assetId) {
      assetIds.add(assetId);
    }
  }
  return Array.from(assetIds);
};

export const countUtf8Bytes = (value: string): number => encodeUtf8(value).length;

export const hasRenderableShareSnapshot = (input: {
  htmlSnapshot?: string | null;
  snapshotVersion?: number | null;
  snapshotHash?: string | null;
  sanitized?: boolean;
}): boolean => {
  if (!input.htmlSnapshot || !input.snapshotHash || input.snapshotVersion == null) return false;
  if (input.sanitized === false) return false;
  const visibleText = stripHtmlTags(String(input.htmlSnapshot || ""))
    .replace(/\s+/g, " ")
    .trim();
  return visibleText.length > 0;
};

export const validateShareSnapshotPayload = (input: {
  htmlSnapshot: string;
  titleSnapshot: string;
  excerptSnapshot: string;
}): string[] => {
  const errors: string[] = [];
  if (countUtf8Bytes(input.htmlSnapshot) > SHARE_HTML_SNAPSHOT_MAX_BYTES) {
    errors.push("html_snapshot exceeds max size");
  }
  if (normalizeShareSnapshotText(input.titleSnapshot, SHARE_TITLE_SNAPSHOT_MAX_CHARS).length !== input.titleSnapshot.length) {
    errors.push("title_snapshot exceeds max length");
  }
  if (
    normalizeShareSnapshotText(input.excerptSnapshot, SHARE_EXCERPT_SNAPSHOT_MAX_CHARS).length !==
    input.excerptSnapshot.length
  ) {
    errors.push("excerpt_snapshot exceeds max length");
  }
  return errors;
};

export const computeShareSnapshotHash = async (input: {
  htmlSnapshot: string;
  titleSnapshot: string;
  excerptSnapshot: string;
}): Promise<string> => {
  const runtimeCrypto = getWebCrypto();
  const normalized = JSON.stringify({
    html: String(input.htmlSnapshot || ""),
    title: normalizeShareSnapshotText(input.titleSnapshot, SHARE_TITLE_SNAPSHOT_MAX_CHARS),
    excerpt: normalizeShareSnapshotText(input.excerptSnapshot, SHARE_EXCERPT_SNAPSHOT_MAX_CHARS),
  });
  const digest = await runtimeCrypto.subtle.digest("SHA-256", asBufferSource(encodeUtf8(normalized)));
  return bytesToHex(new Uint8Array(digest));
};

export const evaluateShareSnapshotUpdate = (input: ShareSnapshotUpdateInput): ShareSnapshotUpdateDecision => {
  const currentVersion = input.currentVersion ?? null;
  const incomingVersion = input.incomingVersion ?? null;
  const currentHash = input.currentHash ?? null;
  const incomingHash = input.incomingHash ?? null;

  if (incomingVersion == null) {
    return {
      code: "conflict",
      reason: "older_version",
    };
  }
  if (currentVersion == null || incomingVersion > currentVersion) {
    return {
      code: "accept",
      reason: "newer_version",
    };
  }
  if (incomingVersion < currentVersion) {
    return {
      code: "conflict",
      reason: "older_version",
    };
  }
  if (currentHash != null && incomingHash != null && currentHash === incomingHash) {
    return {
      code: "idempotent",
      reason: "same_version_same_hash",
    };
  }
  return {
    code: "conflict",
    reason: "same_version_conflict",
  };
};
