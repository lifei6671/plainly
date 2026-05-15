declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;
declare const jest: any;

export {};

jest.mock("../utils/converter", () => ({
  solveHtml: jest.fn(() => ""),
}));

jest.mock("mermaid", () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    run: jest.fn(async ({nodes}) => {
      nodes.forEach((node) => {
        const source = node.textContent || "";
        node.setAttribute("data-processed", "true");
        node.innerHTML = `<svg viewBox="0 0 10 10"><path d="M0 0L10 10"></path><text>${
          source.includes("Christmas") ? "Christmas" : "A"
        }</text></svg>`;
      });
    }),
  },
}), {virtual: true});

const {buildShareSnapshotPayload, isShareSnapshotConflictError, syncShareSnapshotIfEnabled} = require("./browserSnapshot");
const {solveHtml} = require("../utils/converter");

describe("browser snapshot helpers", () => {
  it("builds snapshot payload from markdown and document title", async () => {
    const payload = await buildShareSnapshotPayload({
      markdown: "# 标题\n\n正文第一段。\n\n```ts\nconst a = 1;\n```",
      documentName: "示例文档.md",
      snapshotVersion: 123,
      renderMode: "default",
    });

    expect(payload.snapshotVersion).toBe(123);
    expect(payload.titleSnapshot).toBe("示例文档");
    expect(payload.excerptSnapshot).toContain("标题 正文第一段。");
    expect(payload.excerptSnapshot).not.toContain("const a = 1");
    expect(payload.htmlSnapshot).toContain("<h1");
  });

  it("prefers exported preview html when available", async () => {
    solveHtml.mockReturnValueOnce('<section id="nice"><h1 style="color:red">预览标题</h1></section>');
    const payload = await buildShareSnapshotPayload({
      markdown: "# 标题",
      documentName: "预览文档.md",
      snapshotVersion: 456,
      renderMode: "default",
    });

    expect(payload.snapshotVersion).toBe(456);
    expect(payload.htmlSnapshot).toContain('id="nice"');
    expect(payload.htmlSnapshot).toContain("style=\"color:red\"");
  });

  it("waits for mathjax typeset before capturing formula snapshots", async () => {
    document.body.innerHTML = '<div id="nice-rich-text-box"><section id="nice">行内公式 $x+y$</section></div>';
    let rendered = false;
    (window as any).MathJax = {
      texReset: jest.fn(),
      typesetClear: jest.fn(),
      typesetPromise: jest.fn(async () => {
        rendered = true;
        const layout = document.getElementById("nice");
        if (layout) {
          layout.innerHTML =
            '<span class="span-inline-equation"><section class="inline-equation"><svg viewBox="0 0 10 10"><path d="M0 0"></path></svg></section></span>';
        }
      }),
    };
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");

    const payload = await buildShareSnapshotPayload({
      markdown: "行内公式 $x+y$",
      documentName: "公式文档.md",
      snapshotVersion: 789,
      renderMode: "default",
    });

    expect((window as any).MathJax.texReset).toHaveBeenCalled();
    expect((window as any).MathJax.typesetClear).toHaveBeenCalled();
    expect((window as any).MathJax.typesetPromise).toHaveBeenCalled();
    expect(rendered).toBe(true);
    expect(payload.htmlSnapshot).toContain("<svg");
  });

  it("loads mathjax before capturing formula snapshots when the app loader is not ready yet", async () => {
    document.body.innerHTML = '<div id="nice-rich-text-box"><section id="nice">行内公式 $ABO$</section></div>';
    (window as any).MathJax = undefined;
    (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = jest.fn(async () => {
      (window as any).MathJax = {
        texReset: jest.fn(),
        typesetClear: jest.fn(),
        typesetPromise: jest.fn(async () => {
          const layout = document.getElementById("nice");
          if (layout) {
            layout.innerHTML =
              '<span class="span-inline-equation"><section class="inline-equation"><svg viewBox="0 0 10 10"><path d="M0 0"></path></svg></section></span>';
          }
        }),
      };
    });
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");

    const payload = await buildShareSnapshotPayload({
      markdown: "行内公式 $ABO$",
      documentName: "公式文档.md",
      snapshotVersion: 790,
      renderMode: "default",
    });

    expect((window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__).toHaveBeenCalled();
    expect(payload.htmlSnapshot).toContain("<svg");
    expect(payload.htmlSnapshot).not.toContain("$ABO$");
    (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = undefined;
  });

  it("does not keep polling when the mathjax loader cannot provide a typesetter", async () => {
    document.body.innerHTML = '<div id="nice-rich-text-box"><section id="nice">行内公式 $ABO$</section></div>';
    (window as any).MathJax = undefined;
    (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = jest.fn(async () => undefined);
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");
    let now = 0;
    const dateSpy = jest.spyOn(Date, "now").mockImplementation(() => {
      now += 1000;
      return now;
    });
    const timeoutSpy = jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0 as any;
    });

    try {
      const payload = await buildShareSnapshotPayload({
        markdown: "行内公式 $ABO$",
        documentName: "公式降级.md",
        snapshotVersion: 791,
        renderMode: "default",
      });

      expect((window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__).toHaveBeenCalled();
      expect(payload.htmlSnapshot).toContain("$ABO$");
      expect(timeoutSpy.mock.calls.some((call) => call[1] === 50)).toBe(false);
    } finally {
      timeoutSpy.mockRestore();
      dateSpy.mockRestore();
      (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = undefined;
    }
  });

  it("falls back to raw formula content when the mathjax loader rejects", async () => {
    document.body.innerHTML = '<div id="nice-rich-text-box"><section id="nice">行内公式 $ABO$</section></div>';
    (window as any).MathJax = undefined;
    (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = jest.fn(async () => {
      throw new Error("mathjax chunk failed");
    });
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");

    try {
      const payload = await buildShareSnapshotPayload({
        markdown: "行内公式 $ABO$",
        documentName: "公式降级.md",
        snapshotVersion: 792,
        renderMode: "default",
      });

      expect(payload.htmlSnapshot).toContain("$ABO$");
    } finally {
      (window as any).__PLAINLY_SHARE_SNAPSHOT_MATHJAX_LOADER__ = undefined;
    }
  });

  it("waits for mermaid rendering before capturing diagram snapshots", async () => {
    document.body.innerHTML =
      '<div id="nice-rich-text-box"><section id="nice"><div class="mermaid">graph TD;A-->B;</div></section></div>';
    solveHtml.mockImplementationOnce(() => {
      return document.getElementById("nice-rich-text-box")?.innerHTML || "";
    });

    const payload = await buildShareSnapshotPayload({
      markdown: "```mermaid\ngraph TD;A-->B;\n```",
      documentName: "流程图文档.md",
      snapshotVersion: 999,
      renderMode: "default",
    });

    expect(payload.htmlSnapshot).toContain("<svg");
    expect(payload.htmlSnapshot).toContain("<path");
    const mermaid = require("mermaid").default;
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({
        flowchart: expect.objectContaining({
          htmlLabels: false,
        }),
      }),
    );
  });

  it("rerenders processed mermaid nodes from markdown before capturing diagram snapshots", async () => {
    document.body.innerHTML =
      '<div id="nice-rich-text-box"><section id="nice"><div class="mermaid" data-processed="true"><svg><foreignObject><div></div></foreignObject></svg></div></section></div>';
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");

    const payload = await buildShareSnapshotPayload({
      markdown: "```mermaid\ngraph TD\nA[Christmas]\n```",
      documentName: "流程图文档.md",
      snapshotVersion: 1000,
      renderMode: "default",
    });

    const mermaid = require("mermaid").default;
    expect(mermaid.run).toHaveBeenCalled();
    expect(payload.htmlSnapshot).toContain("Christmas");
    expect(payload.htmlSnapshot).not.toContain("foreignObject");
  });

  it("does not keep polling when mermaid rendering fails", async () => {
    document.body.innerHTML =
      '<div id="nice-rich-text-box"><section id="nice"><div class="mermaid">graph TD;A-->B;</div></section></div>';
    solveHtml.mockImplementationOnce(() => document.getElementById("nice-rich-text-box")?.innerHTML || "");
    const mermaid = require("mermaid").default;
    mermaid.run.mockRejectedValueOnce(new Error("invalid mermaid"));
    let now = 0;
    const dateSpy = jest.spyOn(Date, "now").mockImplementation(() => {
      now += 1000;
      return now;
    });
    const timeoutSpy = jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
      callback();
      return 0 as any;
    });

    try {
      const payload = await buildShareSnapshotPayload({
        markdown: "```mermaid\ngraph TD;A-->B;\n```",
        documentName: "失败图表.md",
        snapshotVersion: 1001,
        renderMode: "default",
      });

      expect(payload.htmlSnapshot).toContain("mermaid");
      expect(timeoutSpy.mock.calls.some((call) => call[1] === 50)).toBe(false);
    } finally {
      timeoutSpy.mockRestore();
      dateSpy.mockRestore();
    }
  });

  it("uses monotonic snapshot versions for the same document", async () => {
    solveHtml.mockReturnValue("");
    const store = {
      getDocumentSettings: jest.fn().mockResolvedValue({
        share: {
          enabled: true,
          snapshotVersion: 5,
        },
      }),
      updateShareSnapshot: jest
        .fn()
        .mockResolvedValueOnce({share: {enabled: true, snapshotVersion: 6}})
        .mockResolvedValueOnce({share: {enabled: true, snapshotVersion: 7}}),
    };

    await syncShareSnapshotIfEnabled({
      store,
      documentUuid: "doc-monotonic",
      documentName: "单调版本.md",
      markdown: "内容 A",
      snapshotVersion: 1,
      renderMode: "default",
    });
    await syncShareSnapshotIfEnabled({
      store,
      documentUuid: "doc-monotonic",
      documentName: "单调版本.md",
      markdown: "内容 B",
      snapshotVersion: 1,
      renderMode: "default",
    });

    expect(store.updateShareSnapshot.mock.calls[0][1].snapshotVersion).toBe(6);
    expect(store.updateShareSnapshot.mock.calls[1][1].snapshotVersion).toBe(7);
  });

  it("recognizes snapshot conflict errors", () => {
    expect(isShareSnapshotConflictError(new Error("snapshot version conflict"))).toBe(true);
    expect(isShareSnapshotConflictError(new Error("network failed"))).toBe(false);
  });
});
