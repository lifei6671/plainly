import {
  buildLiveHeadingAnchors,
  getScrollableRange,
  mapEditorToPreviewByAnchors,
  mapPreviewToEditorByAnchors,
  mapScrollByRatio,
  renderMarkdownWithHeadingAnchors,
} from "./syncScroll";
import {markdownParser, markdownParserWechat} from "./helper";

declare const describe: any;
declare const expect: any;
declare const it: any;

describe("syncScroll", () => {
  it("maps 0%, 25%, 50%, and 100% of the live scrollable range", () => {
    expect(getScrollableRange(1000, 100)).toBe(900);
    expect([0, 225, 450, 900].map((top) => mapScrollByRatio(top, 1000, 100, 2100, 100))).toEqual([0, 500, 1000, 2000]);
  });

  it("returns zero when either side has no scrollable range", () => {
    expect(mapScrollByRatio(10, 100, 100, 1000, 100)).toBe(0);
    expect(mapScrollByRatio(10, 1000, 100, 100, 100)).toBe(0);
  });

  it("clamps positions and never returns NaN for non-finite measurements", () => {
    expect(mapScrollByRatio(-1, 1000, 100, 2100, 100)).toBe(0);
    expect(mapScrollByRatio(1000, 1000, 100, 2100, 100)).toBe(2000);
    [NaN, Infinity, -Infinity].forEach((value) => {
      expect(Number.isNaN(mapScrollByRatio(value, 1000, 100, 2100, 100))).toBe(false);
      expect(Number.isNaN(mapScrollByRatio(100, value, 100, 2100, 100))).toBe(false);
      expect(Number.isNaN(mapScrollByRatio(100, 1000, 100, value, 100))).toBe(false);
    });
  });

  it("uses the target's current range after image height changes", () => {
    expect(mapScrollByRatio(450, 1000, 100, 2000, 100)).toBe(950);
    expect(mapScrollByRatio(450, 1000, 100, 5000, 100)).toBe(2450);
  });

  it("adds source-line markers for headings from both active Markdown parsers", () => {
    [markdownParser, markdownParserWechat].forEach((parser) => {
      const root = document.createElement("div");
      root.innerHTML = renderMarkdownWithHeadingAnchors("# One\n\n## Two\n\n### Three", parser);

      expect(Array.from(root.querySelectorAll("h1,h2,h3")).map((heading) => heading.getAttribute("data-scroll-source-line"))).toEqual([
        "0",
        "2",
        "4",
      ]);
    });
  });

  it("maps a 31-chapter article by live heading positions before and after large images load", () => {
    const imageChapters = [4, 7, 10, 13, 16, 19, 22, 25];
    let imageHeights = [300, 600, 1200, 1600, 300, 600, 1200, 1600];
    const markdown = ["# Long article", ...Array.from({length: 31}, (_, index) => {
      const chapter = index + 1;
      const imageIndex = imageChapters.indexOf(chapter);
      return `## Chapter ${chapter}\n\nParagraph ${chapter}${imageIndex === -1 ? "" : `\n\n![image ${chapter}](https://example.com/${chapter}.png)`}\n\n| A | B |\n| - | - |\n| ${chapter} | ${chapter} |\n\n\`\`\`ts\nconst chapter = ${chapter};\n\`\`\``;
    })].join("\n\n");
    const root = document.createElement("section");
    root.innerHTML = renderMarkdownWithHeadingAnchors(markdown, markdownParser);
    const container = document.createElement("div");
    container.appendChild(root);
    Object.defineProperties(container, {scrollHeight: {value: 50000}, clientHeight: {value: 100}});
    container.getBoundingClientRect = () => ({top: 0, height: 100} as DOMRect);

    const sourceTops = new Map<number, number>();
    const headings = Array.from(root.querySelectorAll("h2"));
    const previewTopForChapter = (chapter: number) =>
      chapter * 700 + imageChapters.reduce((total, imageChapter, index) => total + (imageChapter < chapter ? imageHeights[index] : 0), 0);
    headings.forEach((heading, index) => {
      const chapter = index + 1;
      sourceTops.set(Number(heading.getAttribute("data-scroll-source-line")), chapter * 100);
      heading.getBoundingClientRect = () => ({top: previewTopForChapter(chapter), height: 30} as DOMRect);
    });

    const markdownEditor = {
      getScrollInfo: () => ({height: 4000, clientHeight: 100}),
      heightAtLine: (line) => sourceTops.get(line) || 0,
      lineCount: () => markdown.split("\n").length,
    };
    const beforeLoad = buildLiveHeadingAnchors({markdownEditor, previewContainer: container, previewRoot: root});

    [1, 15, 29, 30, 31].forEach((chapter) => {
      const sourceTop = chapter * 100;
      const previewTop = previewTopForChapter(chapter);
      expect(mapEditorToPreviewByAnchors(beforeLoad, sourceTop)).toBe(previewTop);
      expect(mapPreviewToEditorByAnchors(beforeLoad, previewTop)).toBe(sourceTop);
    });

    const chapter30Before = mapEditorToPreviewByAnchors(beforeLoad, 3000);
    imageHeights = [1600, 1600, 1600, 1600, 1600, 1600, 1600, 1600];
    const afterLoad = buildLiveHeadingAnchors({markdownEditor, previewContainer: container, previewRoot: root});
    expect(mapEditorToPreviewByAnchors(afterLoad, 3000)).toBe(previewTopForChapter(30));
    expect(mapEditorToPreviewByAnchors(afterLoad, 3000)).not.toBe(chapter30Before);
  });

  it("returns no semantic map when heading markers are absent", () => {
    const root = document.createElement("section");
    const container = document.createElement("div");
    container.appendChild(root);
    Object.defineProperties(container, {scrollHeight: {value: 1000}, clientHeight: {value: 100}});

    expect(buildLiveHeadingAnchors({
      markdownEditor: {getScrollInfo: () => ({height: 1000, clientHeight: 100}), heightAtLine: () => 100},
      previewContainer: container,
      previewRoot: root,
    })).toBeNull();
  });
});
