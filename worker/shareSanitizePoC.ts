import {
  SHARE_ALLOWED_TAGS,
  SHARE_GLOBAL_ATTRIBUTES,
  SHARE_REMOVE_WITH_CONTENT_TAGS,
  SHARE_TAG_ATTRIBUTES,
  createEmptyShareSanitizeStats,
  isAllowedShareHref,
  isAllowedShareImageSrc,
  mergeShareAnchorRel,
  normalizeShareUrlAttribute,
  sanitizeShareInlineStyle,
} from "../src/share/security";

type ShareSanitizeStats = {
  removedNodes: number;
  unwrappedNodes: number;
  removedAttrs: number;
  blockedUrls: number;
  removedComments: number;
};

type ShareSanitizeResult = {
  html: string;
  stats: ShareSanitizeStats;
};

type ShareSanitizeSampleResult = ShareSanitizeResult & {
  name: string;
  input: string;
};

const DEFAULT_SAMPLES = [
  {
    name: "script-and-events",
    input:
      '<h1 onclick="alert(1)">Hello</h1><p><a href="javascript:alert(1)" onclick="hack()">bad link</a></p><script>alert(1)</script>',
  },
  {
    name: "table-and-code",
    input:
      '<table><thead><tr><th scope="col">Name</th></tr></thead><tbody><tr><td><code class="language-ts">const x = 1;</code></td></tr></tbody></table>',
  },
  {
    name: "image-and-data-uri",
    input:
      '<figure><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB" alt="ok" /><img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==" alt="bad" /></figure>',
  },
  {
    name: "unwrap-unknown-tag",
    input:
      "<custom-box><p>wrapped text</p></custom-box><iframe src=\"https://evil.example/embed\"></iframe>",
  },
];

class ShareSanitizeElementHandler {
  private stats: ShareSanitizeStats;

  constructor(stats: ShareSanitizeStats) {
    this.stats = stats;
  }

  element(element: any) {
    const tagName = String(element.tagName || "").toLowerCase();
    if (!tagName) return;

      if (!SHARE_ALLOWED_TAGS.has(tagName)) {
        if (SHARE_REMOVE_WITH_CONTENT_TAGS.has(tagName)) {
          element.remove();
          this.stats.removedNodes += 1;
          return;
      }
      if (typeof element.removeAndKeepContent === "function") {
        element.removeAndKeepContent();
        this.stats.unwrappedNodes += 1;
        return;
      }
      element.remove();
      this.stats.removedNodes += 1;
      return;
    }

      const allowedAttrs = new Set([
        ...SHARE_GLOBAL_ATTRIBUTES,
        ...Array.from(SHARE_TAG_ATTRIBUTES[tagName as keyof typeof SHARE_TAG_ATTRIBUTES] || []),
      ]);

    for (const attr of Array.from((element.attributes || []) as any[])) {
      const [rawName, rawValue] = Array.isArray(attr) ? attr : [attr?.name, attr?.value];
      const attrName = String(rawName || "").toLowerCase();
      const attrValue = String(rawValue || "");

      if (!attrName) continue;

      if (attrName.startsWith("on")) {
        element.removeAttribute(attrName);
        this.stats.removedAttrs += 1;
        continue;
      }
      if (attrName === "style") {
        const safeStyle = sanitizeShareInlineStyle(attrValue);
        if (!safeStyle) {
          element.removeAttribute(attrName);
          this.stats.removedAttrs += 1;
          continue;
        }
        if (safeStyle !== attrValue) {
          element.setAttribute(attrName, safeStyle);
        }
        continue;
      }

      if (!allowedAttrs.has(attrName)) {
        element.removeAttribute(attrName);
        this.stats.removedAttrs += 1;
        continue;
      }

      if (attrName === "href" || attrName === "src") {
        const safeValue = normalizeShareUrlAttribute(tagName, attrName, attrValue);
        if (!safeValue) {
          this.stats.blockedUrls += 1;
          if (tagName === "img" && attrName === "src") {
            element.remove();
            this.stats.removedNodes += 1;
            return;
          }
          element.removeAttribute(attrName);
          this.stats.removedAttrs += 1;
          continue;
        }
        if (safeValue !== attrValue) {
          element.setAttribute(attrName, safeValue);
        }
      }
    }

    if (tagName === "a") {
      const target = String(element.getAttribute("target") || "").trim();
      if (target && target !== "_blank" && target !== "_self") {
        element.removeAttribute("target");
        this.stats.removedAttrs += 1;
      }
      if (target === "_blank") {
        element.setAttribute("rel", mergeShareAnchorRel(element.getAttribute("rel")));
      }
    }
  }

  comments(comment: any) {
    comment.remove();
    this.stats.removedComments += 1;
  }
}

const getHtmlRewriter = () => {
  const HtmlRewriterCtor = (globalThis as any).HTMLRewriter;
  if (typeof HtmlRewriterCtor !== "function") {
    throw new Error("HTMLRewriter is not available in the current runtime");
  }
  return HtmlRewriterCtor;
};

export const sanitizeShareHtmlForWorkerPoC = async (html: string): Promise<ShareSanitizeResult> => {
  const HtmlRewriterCtor = getHtmlRewriter();
  const stats = createEmptyShareSanitizeStats();
  const handler = new ShareSanitizeElementHandler(stats);
  const rewriter = new HtmlRewriterCtor().on("*", handler).onDocument(handler);
  const response = new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
  const sanitizedHtml = await rewriter.transform(response).text();
  return {
    html: sanitizedHtml,
    stats,
  };
};

export const runShareSanitizeWorkerPoC = async (html?: string | null) => {
  if (typeof html === "string") {
    return sanitizeShareHtmlForWorkerPoC(html);
  }
  const cases: ShareSanitizeSampleResult[] = [];
  for (const sample of DEFAULT_SAMPLES) {
    const result = await sanitizeShareHtmlForWorkerPoC(sample.input);
    cases.push({
      name: sample.name,
      input: sample.input,
      html: result.html,
      stats: result.stats,
    });
  }
  return {
    runtime: "cloudflare-worker-htmlrewriter",
    cases,
  };
};
