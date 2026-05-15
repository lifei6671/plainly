import {Category, DataStoreMode, DocumentMeta, DocumentShare, TimestampValue} from "../data/store/types";

export type ShareRobotsDirective = "index,follow" | "noindex,nofollow";
export type ShareAccessDecisionCode = "allow" | "not_found" | "forbidden" | "gone" | "rate_limited";
export type ShareReadPageKind = "ssr" | "password" | "shell";
export type ShareAccessTarget = "page" | "content" | "asset";
export type ShareCookiePurpose = "share-access";

export interface ShareCookiePayload {
  shareId: string;
  exp: number;
  iat: number;
  purpose: ShareCookiePurpose;
  passwordVersion: number;
  kid?: string | null;
}

export interface ShareSanitizeStats {
  removedNodes: number;
  unwrappedNodes: number;
  removedAttrs: number;
  blockedUrls: number;
  removedComments: number;
}

export interface ShareSanitizeResult {
  html: string;
  stats: ShareSanitizeStats;
}

export interface SharePolicyShare
  extends Pick<
    DocumentShare,
    | "shareId"
    | "enabled"
    | "listed"
    | "accessType"
    | "durationType"
    | "startAt"
    | "endAt"
    | "passwordVersion"
    | "htmlSnapshot"
    | "snapshotVersion"
    | "snapshotHash"
  > {
  sanitized?: boolean;
}

export interface EvaluateShareAccessInput {
  share: SharePolicyShare | null;
  mode?: DataStoreMode;
  target?: ShareAccessTarget;
  now?: TimestampValue;
  hasPasswordGrant?: boolean;
  isRateLimited?: boolean;
}

export interface ShareAccessDecision {
  code: ShareAccessDecisionCode;
  httpStatus: 200 | 403 | 404 | 410 | 429;
  reason:
    | "missing"
    | "disabled"
    | "not_started"
    | "expired"
    | "rate_limited"
    | "password_required"
    | "ok";
  pageKind: ShareReadPageKind | null;
  requiresPassword: boolean;
  canRenderSsr: boolean;
  canAccessContent: boolean;
  canAccessAsset: boolean;
  canAppearInList: boolean;
  robots: ShareRobotsDirective;
}

export interface ShareRateLimitRule {
  scope: "share_ip" | "share" | "ip";
  threshold: number;
  windowMs: number;
  blockMs: number;
}

export interface ShareRateLimitBucketState {
  failures: number;
  windowStartedAt?: number | null;
  blockedUntil?: number | null;
}

export interface ShareRateLimitDecision {
  allowed: boolean;
  retryAfterSec: number;
  blockedUntil: number | null;
}

export interface ShareSnapshotUpdateInput {
  currentVersion?: number | null;
  currentHash?: string | null;
  incomingVersion?: number | null;
  incomingHash?: string | null;
}

export interface ShareSnapshotUpdateDecision {
  code: "accept" | "idempotent" | "conflict";
  reason: "newer_version" | "same_version_same_hash" | "same_version_conflict" | "older_version";
}

export interface DocumentShareSettings {
  enabled: boolean;
  listed: boolean;
  shareId?: string;
  accessType: "public" | "password";
  durationType: "permanent" | "range";
  startAt?: number | null;
  endAt?: number | null;
  passwordConfigured: boolean;
  passwordVersion?: number | null;
  publicUrl?: string;
  snapshotVersion?: number | null;
  snapshotHash?: string | null;
  htmlSnapshot?: string | null;
  titleSnapshot?: string | null;
  excerptSnapshot?: string | null;
}

export interface DocumentSettingsPayload {
  meta: DocumentMeta | null;
  categories: Category[];
  share: DocumentShareSettings | null;
}

export interface UpdateDocumentSettingsInput {
  meta?: {
    name?: string;
    category_id?: string;
  };
  share?: {
    enabled?: boolean;
    listed?: boolean;
    accessType?: "public" | "password";
    durationType?: "permanent" | "range";
    startAt?: number | null;
    endAt?: number | null;
    password?: string | null;
    regenerateShareId?: boolean;
  };
}

export interface UpdateShareSnapshotInput {
  htmlSnapshot: string;
  titleSnapshot: string;
  excerptSnapshot: string;
  snapshotVersion: number;
}

export interface UpdateShareSnapshotResponse {
  share: DocumentShareSettings | null;
}
