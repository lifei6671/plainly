declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;

export {};

const {SHARE_READ_CSP, renderShareDocumentPage} = require("./read");

describe("share read rendering", () => {
  it("uses preview export wrapper when snapshot already contains the editor preview shell", () => {
    const html = renderShareDocumentPage({
      share: {
        shareId: "preview-shell",
        titleSnapshot: "预览文档",
        excerptSnapshot: "摘要",
        htmlSnapshot: '<div id="nice-rich-text-box"><section id="nice"><h1>标题</h1><p>正文</p></section></div>',
        accessType: "public",
        durationType: "permanent",
        listed: true,
        lastSnapshotAt: Date.now(),
        updatedAt: Date.now(),
      },
      meta: {
        name: "预览文档.md",
        updatedAt: Date.now(),
      },
      robots: "index,follow",
    });

    expect(html).toContain('article class="article article--preview-export"');
    expect(html).toContain('class="article-preview-export"');
    expect(html).toContain('id="nice-rich-text-box"');
    expect(html).toContain(".article--preview-export");
    expect(html).toContain("overflow: visible;");
    expect(html).toContain(".article-preview-export svg");
    expect(html).not.toContain('<div class="article-body"><div id="nice-rich-text-box"');
  });

  it("does not add the fallback dark background to mdnice code blocks", () => {
    const html = renderShareDocumentPage({
      share: {
        shareId: "mdnice-code",
        titleSnapshot: "代码块文档",
        excerptSnapshot: "摘要",
        htmlSnapshot:
          '<pre class="custom" style="border-radius:5px;box-shadow:0 10px 30px rgba(0,0,0,.35)">' +
          '<span style="display:block;height:30px;background:url(https://example.com/mac.svg) no-repeat 10px 10px;background-color:#282c34"></span>' +
          '<code class="hljs" style="display:block;padding:16px;background:#282c34;color:#e6edf3">ag = Agent</code>' +
          "</pre>",
        accessType: "public",
        durationType: "permanent",
        listed: true,
        lastSnapshotAt: Date.now(),
        updatedAt: Date.now(),
      },
      meta: {
        name: "代码块文档.md",
        updatedAt: Date.now(),
      },
      robots: "index,follow",
    });

    expect(html).toContain(".article-body pre:not(.custom):not(.code-snippet__js)");
    expect(html).toContain('class="custom"');
    expect(html).toContain("background:#282c34");
    expect(html).not.toContain(".article-body pre {\n      overflow: auto;\n      padding: 14px;");
  });

  it("renders a right side outline and injects stable heading anchors", () => {
    const html = renderShareDocumentPage({
      share: {
        shareId: "outline-doc",
        titleSnapshot: "大纲文档",
        excerptSnapshot: "摘要",
        htmlSnapshot: "<h2>规则</h2><p>正文</p><h3 id=\"fields\">字段说明</h3>",
        accessType: "public",
        durationType: "permanent",
        listed: true,
        lastSnapshotAt: Date.now(),
        updatedAt: Date.now(),
      },
      meta: {
        name: "大纲文档.md",
        updatedAt: Date.now(),
      },
      robots: "index,follow",
    });

    expect(html).toContain('class="read-layout read-layout--with-outline"');
    expect(html).toContain('<aside class="article-outline" aria-label="文章大纲">');
    expect(html).toContain('class="article-outline__rail-fill"');
    expect(html).toContain('<h2 id="share-heading-1">规则</h2>');
    expect(html).toContain('href="#share-heading-1"');
    expect(html).toContain('data-outline-target="share-heading-1"');
    expect(html).toContain('href="#fields"');
    expect(html).toContain('data-outline-target="fields"');
    expect(html).toContain("<script>");
  });

  it("does not render the outline for short documents", () => {
    const html = renderShareDocumentPage({
      share: {
        shareId: "short-doc",
        titleSnapshot: "短文档",
        excerptSnapshot: "摘要",
        htmlSnapshot: "<h2>只有一个标题</h2><p>正文</p>",
        accessType: "public",
        durationType: "permanent",
        listed: true,
        lastSnapshotAt: Date.now(),
        updatedAt: Date.now(),
      },
      meta: {
        name: "短文档.md",
        updatedAt: Date.now(),
      },
      robots: "index,follow",
    });

    expect(html).toContain('class="read-layout"');
    expect(html).not.toContain('class="article-outline"');
    expect(html).not.toContain("<script>");
  });

  it("keeps the share page CSP locked to the outline highlighter hash", () => {
    expect(SHARE_READ_CSP).toContain("script-src 'sha256-");
    expect(SHARE_READ_CSP).not.toContain("script-src 'unsafe-inline'");
  });
});
