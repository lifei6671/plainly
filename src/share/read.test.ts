declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;

export {};

const {renderShareDocumentPage} = require("./read");

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
    expect(html).not.toContain('<div class="article-body"><div id="nice-rich-text-box"');
  });
});
