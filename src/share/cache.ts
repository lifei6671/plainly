import {DocumentShare, TimestampValue} from "../data/store/types";
import {shouldAppearInShareList} from "./policy";
import {SHARE_LIST_DEFAULT_PAGE_SIZE} from "./read";

export const SHARE_LIST_PATH = "/read";

export const shouldCacheShareListVariant = (input: {
  page: number;
  pageSize: number;
  hasExplicitPageParam?: boolean;
  hasExplicitPageSizeParam?: boolean;
}): boolean =>
  input.page === 1 &&
  !input.hasExplicitPageParam &&
  input.pageSize === SHARE_LIST_DEFAULT_PAGE_SIZE &&
  !input.hasExplicitPageSizeParam;

type ShareCacheRelevantFields =
  | "shareId"
  | "enabled"
  | "listed"
  | "accessType"
  | "durationType"
  | "startAt"
  | "endAt"
  | "passwordVersion"
  | "snapshotVersion"
  | "snapshotHash"
  | "titleSnapshot"
  | "excerptSnapshot";

export interface ShareCachePurger {
  purgeByUrls(urls: string[]): Promise<void>;
}

const SHARE_CACHE_RELEVANT_FIELDS: ShareCacheRelevantFields[] = [
  "shareId",
  "enabled",
  "listed",
  "accessType",
  "durationType",
  "startAt",
  "endAt",
  "passwordVersion",
  "snapshotVersion",
  "snapshotHash",
  "titleSnapshot",
  "excerptSnapshot",
];

const toComparableTimestamp = (value: TimestampValue | null | undefined): number | null => {
  if (value == null) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }
  return null;
};

const areShareValuesEqual = (field: ShareCacheRelevantFields, left: unknown, right: unknown): boolean => {
  if (field === "startAt" || field === "endAt") {
    return toComparableTimestamp(left as TimestampValue | null | undefined) === toComparableTimestamp(right as TimestampValue | null | undefined);
  }
  return (left ?? null) === (right ?? null);
};

const hasShareCacheRelevantChanges = (previousShare: DocumentShare | null, nextShare: DocumentShare | null): boolean => {
  if (!previousShare && !nextShare) return false;
  if (!previousShare || !nextShare) return true;
  return SHARE_CACHE_RELEVANT_FIELDS.some((field) => !areShareValuesEqual(field, previousShare[field], nextShare[field]));
};

export const buildSharePagePath = (shareId?: string | null): string | null => {
  const normalized = String(shareId || "").trim();
  if (!normalized) return null;
  return `/read/${encodeURIComponent(normalized)}`;
};

const pushIfPresent = (set: Set<string>, path: string | null) => {
  if (path) {
    set.add(path);
  }
};

const shouldPurgeListForSettingsChange = (
  previousShare: DocumentShare | null,
  nextShare: DocumentShare | null,
  now: TimestampValue = Date.now(),
): boolean => {
  const previousVisible = shouldAppearInShareList(previousShare, now);
  const nextVisible = shouldAppearInShareList(nextShare, now);
  if (previousVisible || nextVisible) return true;
  if (!previousShare || !nextShare) return previousVisible !== nextVisible;
  return (
    previousShare.enabled !== nextShare.enabled ||
    previousShare.listed !== nextShare.listed ||
    previousShare.accessType !== nextShare.accessType ||
    previousShare.durationType !== nextShare.durationType ||
    !areShareValuesEqual("startAt", previousShare.startAt, nextShare.startAt) ||
    !areShareValuesEqual("endAt", previousShare.endAt, nextShare.endAt)
  );
};

export const collectShareCachePathsForSettingsChange = (input: {
  previousShare: DocumentShare | null;
  nextShare: DocumentShare | null;
  now?: TimestampValue;
}): string[] => {
  if (!hasShareCacheRelevantChanges(input.previousShare, input.nextShare)) {
    return [];
  }
  const paths = new Set<string>();
  pushIfPresent(paths, buildSharePagePath(input.previousShare?.shareId));
  pushIfPresent(paths, buildSharePagePath(input.nextShare?.shareId));
  if (shouldPurgeListForSettingsChange(input.previousShare, input.nextShare, input.now)) {
    paths.add(SHARE_LIST_PATH);
  }
  return Array.from(paths);
};

export const collectShareCachePathsForSnapshotUpdate = (input: {
  previousShare: DocumentShare | null;
  nextShare: DocumentShare | null;
  accepted: boolean;
  now?: TimestampValue;
}): string[] => {
  if (!input.accepted) return [];
  const paths = new Set<string>();
  pushIfPresent(paths, buildSharePagePath(input.nextShare?.shareId || input.previousShare?.shareId));
  if (shouldAppearInShareList(input.nextShare || input.previousShare, input.now)) {
    paths.add(SHARE_LIST_PATH);
  }
  return Array.from(paths);
};

export const buildShareCachePurgeUrls = (origin: string, paths: string[]): string[] => {
  const normalizedOrigin = String(origin || "").replace(/\/+$/g, "");
  if (!normalizedOrigin) return [];
  return Array.from(new Set(paths))
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .map((item) => `${normalizedOrigin}${item.startsWith("/") ? item : `/${item}`}`);
};

export const createCloudflareShareCachePurger = (input: {
  zoneId?: string | null;
  apiToken?: string | null;
  apiBaseUrl?: string | null;
  fetchImpl?: typeof fetch;
}): ShareCachePurger | null => {
  const zoneId = String(input.zoneId || "").trim();
  const apiToken = String(input.apiToken || "").trim();
  if (!zoneId || !apiToken) return null;
  const apiBaseUrl = String(input.apiBaseUrl || "https://api.cloudflare.com/client/v4").replace(/\/+$/g, "");
  const fetchImpl = input.fetchImpl || fetch;
  return {
    async purgeByUrls(urls: string[]) {
      const files = Array.from(new Set((urls || []).map((item) => String(item || "").trim()).filter(Boolean)));
      if (!files.length) return;
      const response = await fetchImpl(`${apiBaseUrl}/zones/${encodeURIComponent(zoneId)}/purge_cache`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiToken}`,
        },
        body: JSON.stringify({files}),
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`cloudflare purge failed: ${response.status} ${body}`.trim());
      }
    },
  };
};
