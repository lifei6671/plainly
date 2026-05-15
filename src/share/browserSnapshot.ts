import type {IDataStore} from "../data/store/IDataStore";
import {solveHtml} from "../utils/converter";
import {extractVisibleText, markdownParser, markdownParserWechat} from "../utils/helper";
import {
  SHARE_EXCERPT_SNAPSHOT_MAX_CHARS,
  SHARE_TITLE_SNAPSHOT_MAX_CHARS,
  normalizeShareSnapshotText,
} from "./snapshot";
import {DocumentShareSettings, UpdateShareSnapshotInput} from "./types";

export type ShareSnapshotRenderMode = "default" | "wechat";

const normalizeSnapshotVersion = (value?: number | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
};

const stripMarkdownFileExt = (value: string): string => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "未命名";
  return trimmed.toLowerCase().endsWith(".md") ? trimmed.slice(0, -3) : trimmed;
};

const getShareSnapshotRenderer = (mode: ShareSnapshotRenderMode) =>
  mode === "wechat" ? markdownParserWechat : markdownParser;

const getPreviewSnapshotHtml = (): string => {
  if (typeof document === "undefined") {
    return "";
  }
  try {
    return solveHtml();
  } catch (_error) {
    return "";
  }
};

export const buildShareSnapshotPayload = (input: {
  markdown: string;
  documentName: string;
  snapshotVersion?: number | null;
  renderMode?: ShareSnapshotRenderMode;
}): UpdateShareSnapshotInput => {
  const renderMode = input.renderMode || "default";
  const htmlSnapshot = getPreviewSnapshotHtml() || getShareSnapshotRenderer(renderMode).render(String(input.markdown || ""));
  const titleSnapshot = normalizeShareSnapshotText(
    stripMarkdownFileExt(input.documentName),
    SHARE_TITLE_SNAPSHOT_MAX_CHARS,
  );
  const excerptSnapshot = normalizeShareSnapshotText(
    extractVisibleText(String(input.markdown || ""), {includeCode: false}),
    SHARE_EXCERPT_SNAPSHOT_MAX_CHARS,
  );
  return {
    htmlSnapshot,
    titleSnapshot,
    excerptSnapshot,
    snapshotVersion: normalizeSnapshotVersion(input.snapshotVersion),
  };
};

export const isShareSnapshotConflictError = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error || "");
  return /snapshot/i.test(message) && /conflict/i.test(message);
};

export const syncShareSnapshotIfEnabled = async (input: {
  store: Pick<IDataStore, "getDocumentSettings" | "updateShareSnapshot">;
  documentUuid: string;
  documentName: string;
  markdown: string;
  snapshotVersion?: number | null;
  renderMode?: ShareSnapshotRenderMode;
  currentShare?: DocumentShareSettings | null;
}): Promise<{share: DocumentShareSettings | null; skipped: boolean}> => {
  const currentShare =
    input.currentShare !== undefined ? input.currentShare : (await input.store.getDocumentSettings(input.documentUuid)).share;
  if (!currentShare?.enabled) {
    return {
      share: currentShare || null,
      skipped: true,
    };
  }

  const payload = buildShareSnapshotPayload({
    markdown: input.markdown,
    documentName: input.documentName,
    snapshotVersion: input.snapshotVersion,
    renderMode: input.renderMode,
  });
  const result = await input.store.updateShareSnapshot(input.documentUuid, payload);
  return {
    share: result.share || currentShare,
    skipped: false,
  };
};
