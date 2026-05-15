import {DocumentMeta, DocumentShare, TimestampValue} from "../data/store/types";
import {normalizeShareAssetId} from "./snapshot";
import {ShareRobotsDirective} from "./types";

export interface PublicShareDocumentContext {
  meta: DocumentMeta;
  share: DocumentShare;
}

export interface PublicShareListPage {
  items: PublicShareDocumentContext[];
  page: number;
  pageSize: number;
  total: number;
}

export const SHARE_LIST_DEFAULT_PAGE_SIZE = 20;
export const SHARE_LIST_MAX_PAGE_SIZE = 50;
export const SHARE_LIST_CACHE_CONTROL = "no-store";
export const SHARE_LIST_CDN_CACHE_CONTROL = "public, max-age=60";
export const SHARE_LIST_VARIANT_CACHE_CONTROL = "no-store";
export const SHARE_LIST_VARIANT_CDN_CACHE_CONTROL = "no-store";
export const SHARE_PAGE_BROWSER_CACHE_CONTROL = "public, max-age=60, must-revalidate";
export const SHARE_PRIVATE_CACHE_CONTROL = "private, no-store";
export const SHARE_CDN_SHORT_CACHE_CONTROL = "public, max-age=60";
export const SHARE_CDN_LONG_CACHE_CONTROL = "public, max-age=604800";
export const SHARE_READ_CSP =
  "default-src 'none'; img-src 'self' https: http: data:; style-src 'self' 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; script-src 'none'";
export const SHARE_REFERRER_POLICY = "strict-origin-when-cross-origin";

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

const padNumber = (value: number): string => String(value).padStart(2, "0");

export const formatShareDateTime = (value: TimestampValue | null | undefined): string => {
  const millis = toMillis(value);
  if (millis == null) return "";
  const date = new Date(millis);
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
};

export const escapeShareHtmlText = (value: string | null | undefined): string =>
  String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const buildSharePath = (shareId: string): string => `/read/${encodeURIComponent(String(shareId || "").trim())}`;

const buildShareAssetPath = (shareId: string, assetId: string): string =>
  `${buildSharePath(shareId)}/assets/${encodeURIComponent(assetId)}`;

const normalizePageNumber = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return Math.floor(parsed);
};

const normalizePageSize = (value: unknown): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) return SHARE_LIST_DEFAULT_PAGE_SIZE;
  return Math.min(SHARE_LIST_MAX_PAGE_SIZE, Math.floor(parsed));
};

export const normalizeShareListPageParams = (input: {
  page?: unknown;
  pageSize?: unknown;
}): {page: number; pageSize: number; offset: number} => {
  const page = normalizePageNumber(input.page);
  const pageSize = normalizePageSize(input.pageSize);
  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize,
  };
};

export const rewriteShareAssetUrls = (html: string, shareId: string): string =>
  String(html || "").replace(/<img\b([^>]*?)\bsrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi, (full, before, rawValue, d1, d2, d3) => {
    const originalValue = d1 || d2 || d3 || "";
    const assetId = normalizeShareAssetId(originalValue);
    if (!assetId) return full;
    const nextValue = rawValue.startsWith("'")
      ? `'${buildShareAssetPath(shareId, assetId)}'`
      : `"${buildShareAssetPath(shareId, assetId)}"`;
    return full.replace(rawValue, nextValue);
  });

const getShareLabels = (share: DocumentShare): string[] => {
  const labels: string[] = [];
  labels.push(share.accessType === "password" ? "需密码" : "完全公开");
  if (share.durationType === "range") {
    labels.push("限时公开");
  } else {
    labels.push("长期公开");
  }
  if (share.listed) {
    labels.push("首页展示");
  }
  return labels;
};

const buildRobotsMeta = (robots: ShareRobotsDirective): string => `<meta name="robots" content="${escapeShareHtmlText(robots)}">`;

const hasExportedPreviewShell = (html: string): boolean => /id=(["'])nice-rich-text-box\1/i.test(String(html || ""));

const buildBaseHtml = (input: {
  title: string;
  description?: string | null;
  robots: ShareRobotsDirective;
  body: string;
}): string => {
  const title = escapeShareHtmlText(input.title);
  const description = escapeShareHtmlText(input.description || "");
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <meta name="description" content="${description}">
  ${buildRobotsMeta(input.robots)}
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f3ea;
      --paper: #fffdf8;
      --ink: #1f1d1a;
      --muted: #6e6557;
      --line: #e6dccb;
      --accent: #a44a2f;
      --accent-soft: rgba(164, 74, 47, 0.1);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Serif SC", "Source Han Serif SC", "PingFang SC", serif;
      color: var(--ink);
      background:
        radial-gradient(circle at top left, rgba(164, 74, 47, 0.12), transparent 32%),
        linear-gradient(180deg, #fbf7f0 0%, var(--bg) 100%);
      min-height: 100vh;
    }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .page {
      max-width: 920px;
      margin: 0 auto;
      padding: 32px 18px 64px;
    }
    .hero {
      margin-bottom: 24px;
      padding: 28px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: rgba(255, 253, 248, 0.92);
      backdrop-filter: blur(6px);
      box-shadow: 0 18px 48px rgba(44, 35, 22, 0.08);
    }
    .eyebrow {
      margin: 0 0 12px;
      color: var(--muted);
      font-size: 13px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    .title {
      margin: 0;
      font-size: clamp(30px, 5vw, 48px);
      line-height: 1.12;
    }
    .desc {
      margin: 14px 0 0;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.7;
    }
    .meta {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 18px;
    }
    .tag {
      display: inline-flex;
      align-items: center;
      padding: 6px 10px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: var(--accent-soft);
      color: var(--accent);
      font-size: 13px;
    }
    .card-list {
      display: grid;
      gap: 16px;
    }
    .card {
      padding: 22px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: var(--paper);
      box-shadow: 0 12px 32px rgba(44, 35, 22, 0.06);
    }
    .card h2, .card h3 {
      margin: 0 0 10px;
      font-size: 24px;
      line-height: 1.35;
    }
    .card p {
      margin: 0;
      color: var(--muted);
      line-height: 1.75;
    }
    .pager {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 20px;
      color: var(--muted);
      font-size: 14px;
    }
    .article {
      padding: 30px;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--paper);
      box-shadow: 0 14px 38px rgba(44, 35, 22, 0.08);
    }
    .article--preview-export {
      padding: 20px;
      overflow: hidden;
    }
    .article-body {
      font-size: 17px;
      line-height: 1.9;
    }
    .article-preview-export #nice-rich-text-box {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
      background: transparent !important;
    }
    .article-preview-export #nice {
      width: 100%;
      max-width: 100%;
      margin: 0 auto;
    }
    .article-preview-export img {
      max-width: 100%;
      height: auto;
    }
    .article-preview-export pre {
      overflow: auto;
    }
    .article-body img {
      max-width: 100%;
      height: auto;
      border-radius: 14px;
    }
    .article-body pre {
      overflow: auto;
      padding: 14px;
      border-radius: 14px;
      background: #1e1a17;
      color: #f9f2e7;
    }
    .article-body table {
      width: 100%;
      border-collapse: collapse;
    }
    .article-body th,
    .article-body td {
      padding: 10px 12px;
      border: 1px solid var(--line);
    }
    .form {
      display: grid;
      gap: 14px;
      max-width: 420px;
    }
    .field-label {
      font-size: 14px;
      color: var(--muted);
    }
    .input {
      width: 100%;
      padding: 12px 14px;
      border: 1px solid var(--line);
      border-radius: 14px;
      background: #fff;
      color: var(--ink);
      font: inherit;
    }
    .button {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      min-height: 44px;
      padding: 0 18px;
      border: 0;
      border-radius: 999px;
      background: var(--accent);
      color: #fffdf8;
      font: inherit;
      cursor: pointer;
    }
    .notice {
      padding: 14px 16px;
      border-radius: 16px;
      background: rgba(164, 74, 47, 0.08);
      color: var(--accent);
      border: 1px solid rgba(164, 74, 47, 0.16);
    }
    .empty {
      padding: 30px;
      border-radius: 24px;
      background: var(--paper);
      border: 1px dashed var(--line);
      color: var(--muted);
      text-align: center;
    }
    @media (max-width: 720px) {
      .page { padding: 20px 14px 42px; }
      .hero, .article, .card { padding: 20px; border-radius: 18px; }
      .article-body { font-size: 16px; }
    }
  </style>
</head>
<body>
  <main class="page">
    ${input.body}
  </main>
</body>
</html>`;
};

const resolveListPageRobots = (items: PublicShareDocumentContext[]): ShareRobotsDirective =>
  items.every((item) => item.share.accessType === "public" && item.share.durationType === "permanent")
    ? "index,follow"
    : "noindex,nofollow";

export const renderShareListPage = (page: PublicShareListPage): string => {
  const prevPage = page.page > 1 ? page.page - 1 : null;
  const hasNextPage = page.page * page.pageSize < page.total;
  const robots = resolveListPageRobots(page.items);
  const listHtml =
    page.items.length > 0
      ? page.items
          .map((item) => {
            const title = escapeShareHtmlText(item.share.titleSnapshot || item.meta.name || "未命名文档");
            const excerpt = escapeShareHtmlText(item.share.excerptSnapshot || "暂无摘要");
            const labels = getShareLabels(item.share)
              .map((label) => `<span class="tag">${escapeShareHtmlText(label)}</span>`)
              .join("");
            return `<article class="card">
  <h2><a href="${buildSharePath(item.share.shareId)}">${title}</a></h2>
  <p>${excerpt}</p>
  <div class="meta">
    ${labels}
    <span class="tag">创建于 ${escapeShareHtmlText(formatShareDateTime(item.meta.createdAt))}</span>
  </div>
</article>`;
          })
          .join("\n")
      : `<div class="empty">当前没有可展示的公开文档。</div>`;

  const pager = `<div class="pager">
  <span>${page.total > 0 ? `第 ${page.page} 页，共 ${Math.max(1, Math.ceil(page.total / page.pageSize))} 页` : "暂无分页"}</span>
  <span>
    ${prevPage ? `<a href="/read?page=${prevPage}">上一页</a>` : "上一页"}
    ${prevPage && hasNextPage ? " · " : ""}
    ${hasNextPage ? `<a href="/read?page=${page.page + 1}">下一页</a>` : "下一页"}
  </span>
</div>`;

  return buildBaseHtml({
    title: "公开文档列表",
    description: "当前实例中可公开访问的文档列表。",
    robots,
    body: `<section class="hero">
  <p class="eyebrow">Plainly Public Read</p>
  <h1 class="title">公开文档列表</h1>
  <p class="desc">这里按创建时间倒序展示当前实例允许出现在公开首页的文档。</p>
</section>
<section class="card-list">${listHtml}</section>
${pager}`,
  });
};

export const renderShareStatusPage = (input: {
  title: string;
  message: string;
  robots?: ShareRobotsDirective;
}): string =>
  buildBaseHtml({
    title: input.title,
    description: input.message,
    robots: input.robots || "noindex,nofollow",
    body: `<section class="hero">
  <p class="eyebrow">Plainly Public Read</p>
  <h1 class="title">${escapeShareHtmlText(input.title)}</h1>
  <p class="desc">${escapeShareHtmlText(input.message)}</p>
</section>`,
  });

export const renderSharePasswordPage = (input: {
  share: DocumentShare;
  meta: DocumentMeta;
  errorMessage?: string | null;
}): string => {
  const title = input.share.titleSnapshot || input.meta.name || "受保护文档";
  const excerpt = input.share.excerptSnapshot || "该文档需要输入访问密码。";
  return buildBaseHtml({
    title,
    description: excerpt,
    robots: "noindex,nofollow",
    body: `<section class="hero">
  <p class="eyebrow">Protected Read</p>
  <h1 class="title">${escapeShareHtmlText(title)}</h1>
  <p class="desc">${escapeShareHtmlText(excerpt)}</p>
  ${input.errorMessage ? `<p class="notice">${escapeShareHtmlText(input.errorMessage)}</p>` : ""}
</section>
<section class="article">
  <form class="form" method="post" action="${buildSharePath(input.share.shareId)}/access">
    <label>
      <span class="field-label">访问密码</span>
      <input class="input" type="password" name="password" autocomplete="current-password" required>
    </label>
    <button class="button" type="submit">继续阅读</button>
  </form>
</section>`,
  });
};

export const renderShareDocumentPage = (input: {
  share: DocumentShare;
  meta: DocumentMeta;
  robots: ShareRobotsDirective;
  shellMode?: boolean;
}): string => {
  const title = input.share.titleSnapshot || input.meta.name || "未命名文档";
  const excerpt = input.share.excerptSnapshot || "公开阅读页面";
  const contentHtml = rewriteShareAssetUrls(String(input.share.htmlSnapshot || ""), input.share.shareId);
  const usesPreviewShell = hasExportedPreviewShell(contentHtml);
  const labels = getShareLabels(input.share)
    .map((label) => `<span class="tag">${escapeShareHtmlText(label)}</span>`)
    .join("");
  const shellNotice = input.shellMode
    ? `<p class="notice">当前文档通过受控阅读页展示，不参与公开索引。</p>`
    : "";
  return buildBaseHtml({
    title,
    description: excerpt,
    robots: input.robots,
    body: `<section class="hero">
  <p class="eyebrow">${input.shellMode ? "Controlled Read" : "Public Read"}</p>
  <h1 class="title">${escapeShareHtmlText(title)}</h1>
  <p class="desc">${escapeShareHtmlText(excerpt)}</p>
  <div class="meta">
    ${labels}
    <span class="tag">更新时间 ${escapeShareHtmlText(formatShareDateTime(input.meta.updatedAt || input.share.lastSnapshotAt || input.share.updatedAt))}</span>
  </div>
  ${shellNotice}
</section>
<article class="article${usesPreviewShell ? " article--preview-export" : ""}">
  ${
    usesPreviewShell
      ? `<div class="article-preview-export">${contentHtml}</div>`
      : `<div class="article-body">${contentHtml}</div>`
  }
</article>`,
  });
};

export const buildShareContentPayload = (share: DocumentShare, meta: DocumentMeta) => ({
  shareId: share.shareId,
  title: share.titleSnapshot || meta.name || "未命名文档",
  excerpt: share.excerptSnapshot || "",
  html: rewriteShareAssetUrls(String(share.htmlSnapshot || ""), share.shareId),
  accessType: share.accessType,
  durationType: share.durationType,
  listed: share.listed,
  updatedAt: meta.updatedAt || share.lastSnapshotAt || share.updatedAt,
});

export const shouldUseLongShareCdnCache = (
  lastModifiedAt: TimestampValue | null | undefined,
  now: TimestampValue = Date.now(),
): boolean => {
  const lastModifiedMs = toMillis(lastModifiedAt);
  const nowMs = toMillis(now) ?? Date.now();
  if (lastModifiedMs == null) return false;
  return nowMs - lastModifiedMs >= 7 * 24 * 60 * 60 * 1000;
};
