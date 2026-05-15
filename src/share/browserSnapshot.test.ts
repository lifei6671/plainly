declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;
declare const jest: any;

export {};

jest.mock("../utils/converter", () => ({
  solveHtml: jest.fn(() => ""),
}));

const {buildShareSnapshotPayload, isShareSnapshotConflictError} = require("./browserSnapshot");
const {solveHtml} = require("../utils/converter");

describe("browser snapshot helpers", () => {
  it("builds snapshot payload from markdown and document title", () => {
    const payload = buildShareSnapshotPayload({
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

  it("prefers exported preview html when available", () => {
    solveHtml.mockReturnValueOnce('<section id="nice"><h1 style="color:red">预览标题</h1></section>');
    const payload = buildShareSnapshotPayload({
      markdown: "# 标题",
      documentName: "预览文档.md",
      snapshotVersion: 456,
      renderMode: "default",
    });

    expect(payload.snapshotVersion).toBe(456);
    expect(payload.htmlSnapshot).toContain('id="nice"');
    expect(payload.htmlSnapshot).toContain("style=\"color:red\"");
  });

  it("recognizes snapshot conflict errors", () => {
    expect(isShareSnapshotConflictError(new Error("snapshot version conflict"))).toBe(true);
    expect(isShareSnapshotConflictError(new Error("network failed"))).toBe(false);
  });
});
