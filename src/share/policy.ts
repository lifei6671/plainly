import {TimestampValue} from "../data/store/types";
import {hasRenderableShareSnapshot} from "./snapshot";
import {EvaluateShareAccessInput, ShareAccessDecision, SharePolicyShare, ShareRobotsDirective} from "./types";

export const SHARE_INDEX_ROBOTS: ShareRobotsDirective = "index,follow";
export const SHARE_NOINDEX_ROBOTS: ShareRobotsDirective = "noindex,nofollow";

const toMillis = (value: TimestampValue | null | undefined): number | null => {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
  }
  return null;
};

const isPublicPermanentShare = (share: Pick<SharePolicyShare, "accessType" | "durationType">): boolean =>
  share.accessType === "public" && share.durationType === "permanent";

export const getDefaultListedValue = (share: Pick<SharePolicyShare, "accessType" | "durationType">): boolean =>
  isPublicPermanentShare(share);

export const resolveListedValue = (input: {
  accessType: SharePolicyShare["accessType"];
  durationType: SharePolicyShare["durationType"];
  currentListed?: boolean | null;
  requestedListed?: boolean | null;
  strategyChanged?: boolean;
}): boolean => {
  const defaultListed = getDefaultListedValue(input);
  if (input.strategyChanged) {
    if (input.requestedListed != null) return Boolean(input.requestedListed);
    return defaultListed;
  }
  if (input.requestedListed != null) return Boolean(input.requestedListed);
  if (input.currentListed != null) return Boolean(input.currentListed);
  return defaultListed;
};

export const getShareWindowState = (
  share: Pick<SharePolicyShare, "enabled" | "durationType" | "startAt" | "endAt">,
  now: TimestampValue = Date.now(),
): "disabled" | "not_started" | "expired" | "active" => {
  if (!share.enabled) return "disabled";
  if (share.durationType !== "range") return "active";
  const current = toMillis(now) ?? Date.now();
  const startAt = toMillis(share.startAt);
  const endAt = toMillis(share.endAt);
  if (startAt != null && current < startAt) return "not_started";
  if (endAt != null && current > endAt) return "expired";
  return "active";
};

export const shouldAppearInShareList = (share: SharePolicyShare | null, now: TimestampValue = Date.now()): boolean => {
  if (!share || !share.listed) return false;
  return getShareWindowState(share, now) === "active";
};

export const getShareRobotsDirective = (share: SharePolicyShare | null): ShareRobotsDirective => {
  if (!share) return SHARE_NOINDEX_ROBOTS;
  if (share.listed && isPublicPermanentShare(share)) {
    return SHARE_INDEX_ROBOTS;
  }
  return SHARE_NOINDEX_ROBOTS;
};

export const canRenderShareSsr = (
  share: SharePolicyShare | null,
  mode: string = "remote",
  now: TimestampValue = Date.now(),
): boolean => {
  if (!share || mode !== "remote") return false;
  if (!isPublicPermanentShare(share)) return false;
  if (getShareWindowState(share, now) !== "active") return false;
  return hasRenderableShareSnapshot(share);
};

export const evaluateShareAccess = (input: EvaluateShareAccessInput): ShareAccessDecision => {
  const {share} = input;
  const target = input.target || "page";
  const mode = input.mode || "remote";
  const requiresPassword = share?.accessType === "password";
  const robots = getShareRobotsDirective(share);

  if (!share) {
    return {
      code: "not_found",
      httpStatus: 404,
      reason: "missing",
      pageKind: null,
      requiresPassword: false,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: false,
      robots,
    };
  }
  if (input.isRateLimited) {
    return {
      code: "rate_limited",
      httpStatus: 429,
      reason: "rate_limited",
      pageKind: null,
      requiresPassword,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: false,
      robots,
    };
  }

  const windowState = getShareWindowState(share, input.now);
  if (windowState === "disabled") {
    return {
      code: "gone",
      httpStatus: 410,
      reason: "disabled",
      pageKind: null,
      requiresPassword,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: false,
      robots,
    };
  }
  if (windowState === "not_started") {
    return {
      code: "forbidden",
      httpStatus: 403,
      reason: "not_started",
      pageKind: null,
      requiresPassword,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: false,
      robots,
    };
  }
  if (windowState === "expired") {
    return {
      code: "gone",
      httpStatus: 410,
      reason: "expired",
      pageKind: null,
      requiresPassword,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: false,
      robots,
    };
  }

  const hasPasswordGrant = Boolean(input.hasPasswordGrant);
  if ((target === "content" || target === "asset") && requiresPassword && !hasPasswordGrant) {
    return {
      code: "forbidden",
      httpStatus: 403,
      reason: "password_required",
      pageKind: null,
      requiresPassword: true,
      canRenderSsr: false,
      canAccessContent: false,
      canAccessAsset: false,
      canAppearInList: shouldAppearInShareList(share, input.now),
      robots,
    };
  }

  const canRenderSsr = target === "page" && canRenderShareSsr(share, mode, input.now);
  const pageKind = target !== "page" ? null : canRenderSsr ? "ssr" : requiresPassword && !hasPasswordGrant ? "password" : "shell";
  const canAccessProtected = !requiresPassword || hasPasswordGrant;

  return {
    code: "allow",
    httpStatus: 200,
    reason: "ok",
    pageKind,
    requiresPassword,
    canRenderSsr,
    canAccessContent: canAccessProtected,
    canAccessAsset: canAccessProtected,
    canAppearInList: shouldAppearInShareList(share, input.now),
    robots,
  };
};

