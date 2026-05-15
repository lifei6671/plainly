import type {IDataStore} from "../data/store/IDataStore";
import {solveHtml} from "../utils/converter";
import {BOX_ID, LAYOUT_ID} from "../utils/constant";
import {extractVisibleText, markdownParser, markdownParserWechat} from "../utils/helper";
import {
  SHARE_EXCERPT_SNAPSHOT_MAX_CHARS,
  SHARE_TITLE_SNAPSHOT_MAX_CHARS,
  normalizeShareSnapshotText,
} from "./snapshot";
import {DocumentShareSettings, UpdateShareSnapshotInput} from "./types";

export type ShareSnapshotRenderMode = "default" | "wechat";

const SHARE_MATHJAX_READY_TIMEOUT_MS = 5000;
const SHARE_MERMAID_READY_TIMEOUT_MS = 5000;
const SHARE_MERMAID_READY_POLL_MS = 50;
const SHARE_PREVIEW_READY_POLL_MS = 50;
const SHARE_MERMAID_SNAPSHOT_CONFIG = {
  startOnLoad: false,
  securityLevel: "strict",
  flowchart: {
    htmlLabels: false,
  },
};

let shareSnapshotMathJaxLoading: Promise<void> | null = null;
const latestIssuedSnapshotVersions = new Map<string, number>();

const normalizeSnapshotVersion = (value?: number | null): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : Date.now();
};

const reserveSnapshotVersion = (input: {
  documentUuid: string;
  snapshotVersion?: number | null;
  currentShare?: DocumentShareSettings | null;
}): number => {
  const normalizedRequestedVersion = normalizeSnapshotVersion(input.snapshotVersion);
  const currentShareVersion = Number(input.currentShare?.snapshotVersion) || 0;
  const latestIssuedVersion = latestIssuedSnapshotVersions.get(input.documentUuid) || 0;
  const nextVersion = Math.max(normalizedRequestedVersion, currentShareVersion + 1, latestIssuedVersion + 1);
  latestIssuedSnapshotVersions.set(input.documentUuid, nextVersion);
  return nextVersion;
};

const isSupersededSnapshotConflict = (input: {
  documentUuid: string;
  attemptedVersion: number;
  error: unknown;
}): boolean => {
  if (!isShareSnapshotConflictError(input.error)) {
    return false;
  }
  const latestIssuedVersion = latestIssuedSnapshotVersions.get(input.documentUuid) || 0;
  return latestIssuedVersion > input.attemptedVersion;
};

const stripMarkdownFileExt = (value: string): string => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "未命名";
  return trimmed.toLowerCase().endsWith(".md") ? trimmed.slice(0, -3) : trimmed;
};

const getShareSnapshotRenderer = (mode: ShareSnapshotRenderMode) =>
  mode === "wechat" ? markdownParserWechat : markdownParser;

const mightContainMathFormula = (markdown: string): boolean => {
  const source = String(markdown || "");
  if (!source.includes("$")) {
    return false;
  }
  return /\$\$[\s\S]+?\$\$|\$(?!\s)[^$\n]+?\$/.test(source);
};

const mightContainMermaidDiagram = (markdown: string): boolean => /```mermaid(?:\s|$)/i.test(String(markdown || ""));

const extractMermaidDiagramSources = (markdown: string): string[] => {
  const sources: string[] = [];
  const sourceText = String(markdown || "");
  const fenceRegex = /(?:^|\n)```mermaid[^\r\n]*(?:\r?\n)([\s\S]*?)(?:\r?\n)?```/gi;
  for (let match = fenceRegex.exec(sourceText); match; match = fenceRegex.exec(sourceText)) {
    const source = String(match[1] || "").trim();
    if (source) {
      sources.push(source);
    }
  }
  return sources;
};

const waitForNextPaint = async (): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }
  await new Promise<void>((resolve) => {
    if (typeof window.requestAnimationFrame === "function") {
      window.requestAnimationFrame(() => resolve());
      return;
    }
    window.setTimeout(() => resolve(), 0);
  });
};

const waitForMs = async (ms: number): Promise<void> => {
  if (typeof window === "undefined") {
    return;
  }
  await new Promise<void>((resolve) => {
    window.setTimeout(() => resolve(), ms);
  });
};

const getPreviewBox = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(BOX_ID);
};

const getPreviewLayout = (): HTMLElement | null => {
  if (typeof document === "undefined") {
    return null;
  }
  return document.getElementById(LAYOUT_ID);
};

const getPendingMermaidNodes = (): HTMLElement[] => {
  if (typeof document === "undefined") {
    return [];
  }
  return (Array.from(document.querySelectorAll(".mermaid")) as HTMLElement[]).filter(
    (node) => !node.getAttribute("data-processed"),
  );
};

const prepareMermaidNodesForSnapshot = (markdown: string): void => {
  if (typeof document === "undefined") {
    return;
  }
  const sources = extractMermaidDiagramSources(markdown);
  if (!sources.length) {
    return;
  }
  const nodes = Array.from(document.querySelectorAll(".mermaid")) as HTMLElement[];
  nodes.forEach((node, index) => {
    const source = sources[index];
    if (!source) {
      return;
    }
    // 快照必须从 markdown 源码重渲染，不能复用编辑器里已经处理过的旧 SVG。
    node.removeAttribute("data-processed");
    node.textContent = source;
  });
};

const hasRenderedMermaidSvg = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  return document.querySelectorAll(".mermaid svg").length > 0;
};

const hasRenderedMermaidOutput = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  const nodes = Array.from(document.querySelectorAll(".mermaid"));
  if (!nodes.length) {
    return false;
  }
  return nodes.every((node) => node.querySelector("svg"));
};

const hasRenderedMathSvg = (): boolean => {
  if (typeof document === "undefined") {
    return false;
  }
  return document.querySelectorAll(".inline-equation svg, .block-equation svg, mjx-container svg").length > 0;
};

const hasMathJaxTypesetter = (): boolean =>
  typeof window !== "undefined" && Boolean(window.MathJax && typeof window.MathJax.typesetPromise === "function");

const ensureShareSnapshotMathJaxLoaded = async (): Promise<boolean> => {
  if (typeof window === "undefined") {
    return false;
  }
  if (hasMathJaxTypesetter()) {
    return true;
  }
  const customLoader = (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__;
  if (typeof customLoader === "function") {
    try {
      await customLoader();
      return hasMathJaxTypesetter();
    } catch (_error) {
      return false;
    }
  }
  const windowAny = window as any;
  const currentMathJax = windowAny.MathJax || {};
  windowAny.MathJax = {
    tex: {
      inlineMath: [["$", "$"]],
      displayMath: [["$$", "$$"]],
      tags: "ams",
    },
    svg: {
      fontCache: "none",
    },
    ...currentMathJax,
  };
  if (!shareSnapshotMathJaxLoading) {
    shareSnapshotMathJaxLoading = import("mathjax/es5/tex-svg-full")
      .then(() => undefined)
      .catch(() => {
        shareSnapshotMathJaxLoading = null;
      });
  }
  await shareSnapshotMathJaxLoading;
  return hasMathJaxTypesetter();
};

const isPreviewSnapshotReady = (markdown: string, options?: {skipMath?: boolean; skipMermaid?: boolean}): boolean => {
  if (!getPreviewBox() || !getPreviewLayout()) {
    return false;
  }
  if (!options?.skipMermaid && mightContainMermaidDiagram(markdown) && !hasRenderedMermaidOutput()) {
    return false;
  }
  if (!options?.skipMath && mightContainMathFormula(markdown) && !hasRenderedMathSvg()) {
    return false;
  }
  return true;
};

const waitForPreviewSnapshotReady = async (markdown: string, options?: {skipMath?: boolean; skipMermaid?: boolean}): Promise<void> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return;
  }
  if ((options?.skipMath || !mightContainMathFormula(markdown)) && (options?.skipMermaid || !mightContainMermaidDiagram(markdown))) {
    return;
  }
  if (!getPreviewBox() || !getPreviewLayout()) {
    return;
  }
  const pollPreviewSnapshotReady = async (startedAt: number, timeoutMs: number): Promise<void> => {
    if (Date.now() - startedAt > timeoutMs) {
      return;
    }
    if (isPreviewSnapshotReady(markdown, options)) {
      await waitForNextPaint();
      await waitForNextPaint();
      return;
    }
    await waitForMs(SHARE_PREVIEW_READY_POLL_MS);
    await waitForNextPaint();
    await pollPreviewSnapshotReady(startedAt, timeoutMs);
  };

  await pollPreviewSnapshotReady(Date.now(), Math.max(SHARE_MATHJAX_READY_TIMEOUT_MS, SHARE_MERMAID_READY_TIMEOUT_MS));
};

const ensurePreviewMermaidSnapshotReady = async (markdown: string): Promise<boolean> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  if (!mightContainMermaidDiagram(markdown)) {
    return true;
  }

  await waitForNextPaint();
  prepareMermaidNodesForSnapshot(markdown);

  const pollMermaidSnapshotReady = async (startedAt: number): Promise<boolean> => {
    if (Date.now() - startedAt > SHARE_MERMAID_READY_TIMEOUT_MS) {
      return false;
    }
    const pendingNodes = getPendingMermaidNodes();
    if (!pendingNodes.length && hasRenderedMermaidSvg()) {
      return true;
    }
    if (pendingNodes.length) {
      try {
        const module = await import("mermaid");
        const mermaid: any = module.default || module;
        if (typeof mermaid.initialize === "function") {
          mermaid.initialize(SHARE_MERMAID_SNAPSHOT_CONFIG);
        }
        if (typeof mermaid.run === "function") {
          await mermaid.run({nodes: pendingNodes});
        } else if (typeof mermaid.init === "function") {
          mermaid.init(undefined, pendingNodes);
        }
      } catch (_error) {
        // 交给 markdown fallback，避免快照流程被图表渲染阻塞。
        return false;
      }
    }
    await waitForMs(SHARE_MERMAID_READY_POLL_MS);
    await waitForNextPaint();
    return pollMermaidSnapshotReady(startedAt);
  };

  return pollMermaidSnapshotReady(Date.now());
};

const ensurePreviewMathSnapshotReady = async (markdown: string): Promise<boolean> => {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }
  if (!mightContainMathFormula(markdown)) {
    return true;
  }

  await waitForNextPaint();
  const canTypeset = await ensureShareSnapshotMathJaxLoaded();
  if (!canTypeset) {
    return false;
  }

  const mathJax = window.MathJax;
  try {
    if (typeof mathJax.texReset === "function") {
      mathJax.texReset();
    }
    if (typeof mathJax.typesetClear === "function") {
      mathJax.typesetClear();
    }
    await mathJax.typesetPromise();
    return true;
  } catch (_error) {
    // 交给 markdown fallback，避免公式渲染失败拖慢快照保存。
    return false;
  }
};

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

export const buildShareSnapshotPayload = async (input: {
  markdown: string;
  documentName: string;
  snapshotVersion?: number | null;
  renderMode?: ShareSnapshotRenderMode;
}): Promise<UpdateShareSnapshotInput> => {
  const renderMode = input.renderMode || "default";
  const shouldWaitForMermaid = await ensurePreviewMermaidSnapshotReady(input.markdown);
  const shouldWaitForMath = await ensurePreviewMathSnapshotReady(input.markdown);
  await waitForPreviewSnapshotReady(input.markdown, {skipMath: !shouldWaitForMath, skipMermaid: !shouldWaitForMermaid});
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

  const snapshotVersion = reserveSnapshotVersion({
    documentUuid: input.documentUuid,
    snapshotVersion: input.snapshotVersion,
    currentShare,
  });

  const payload = await buildShareSnapshotPayload({
    markdown: input.markdown,
    documentName: input.documentName,
    snapshotVersion,
    renderMode: input.renderMode,
  });
  try {
    const result = await input.store.updateShareSnapshot(input.documentUuid, payload);
    return {
      share: result.share || currentShare,
      skipped: false,
    };
  } catch (error) {
    if (isSupersededSnapshotConflict({documentUuid: input.documentUuid, attemptedVersion: snapshotVersion, error})) {
      return {
        share: currentShare || null,
        skipped: false,
      };
    }
    throw error;
  }
};
