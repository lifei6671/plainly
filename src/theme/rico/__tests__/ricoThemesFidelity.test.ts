/* eslint-disable import/first */
declare const afterEach: any;
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

jest.mock("../../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

import juice from "juice";
import BASIC_THEME_CSS from "../../../template/basic";
import {themeRegistry} from "../..";
import {renderThemePreview, TECH_DEPTH_TECHNICAL_ARTICLE} from "../../component/__tests__/themePreviewHarness";
import {RICO_THEMES} from "../themes";

const RICO_COMMIT = "8c22fe5711365ffe646a0987b6d670d22511de58";
const SOURCE_PREFIX = `ricocc/rico-md@${RICO_COMMIT}: assets/styles/themes/`;

const RICO_CONTRACTS = [
  {
    id: "rico-minimalism",
    name: "简约沉浸",
    category: "简约主义",
    source: "minimalism.js",
    values: {
      p: ["font-size: 16px", "line-height: 1.78 !important", "letter-spacing: 0.022em"],
      h1: ["font-size: 31px", "font-weight: 700"],
      h2: ["font-size: 25px", "line-height: 1.34 !important"],
      h3: ["font-size: 21px", "font-weight: 650"],
      h4: ["font-size: 18px", "line-height: 1.46 !important"],
      h5: ["font-size: 17px", "line-height: 1.5 !important"],
      h6: ["font-size: 16px", "line-height: 1.52 !important"],
      strong: ["font-weight: 700", "rgba(0, 0, 0, 0.96)"],
      em: ["font-style: italic", "rgba(0, 0, 0, 0.86)"],
      a: ["color: #4f647f", "rgba(79, 100, 127, 0.45)"],
      blockquote: ["border-left: 3px solid #d8dde4", "background-color: #fbfcfd"],
      ul: ["padding-left: 27px"],
      li: ["line-height: 1.74 !important"],
      hr: ["border-top: 1px solid #e8edf2"],
      code: ["font-size: 13.5px", "background-color: #f2f5f8"],
      img: ["margin: 0 auto 22px", "border-radius: 6px"],
      table: ["width: calc(100% - 16px)", "font-size: 15px"],
      th: ["background-color: #f7f9fb", "border: 1px solid #e6ebf1"],
      td: ["border: 1px solid #e6ebf1", "rgba(0, 0, 0, 0.88)"],
      tr: ["border-bottom: 1px solid #e6ebf1"],
    },
    inline: {
      paragraphColor: "rgba(0, 0, 0, 0.9)", paragraphLineHeight: "1.78", quoteBackground: "rgb(251, 252, 253)",
      tableFontSize: "15px", tableHeaderFontSize: "inherit", tableCellFontSize: "inherit", listColor: "rgba(0, 0, 0, 0.9)",
      paragraphFontSize: "16px", hrHeight: "auto", linkWeight: "inherit", quoteFontSize: "inherit", strongColor: "rgba(0, 0, 0, 0.96)", rowBottomBorder: "1px", rowLineHeight: "",
    },
  },
  {
    id: "rico-wechat-anthropic",
    name: "Claude",
    category: "技术阅读",
    source: "wechat-anthropic.js",
    values: {
      p: ["line-height: 1.75 !important", "color: #2b2b2b", "letter-spacing: -0.005em"],
      h1: ["font-size: 24px", "#e97d5b 50%"],
      h2: ["font-size: 22px", "#9DC88D 100%"],
      h3: ["font-size: 18px", "letter-spacing: -0.015em"],
      h4: ["font-size: 17px", "color: #2a2a2a"],
      h5: ["font-size: 15px", "color: #4a4a4a"],
      h6: ["font-size: 14px", "color: #5a5a5a"],
      strong: ["font-weight: 500", "rgba(193, 95, 60, 0.08)"],
      em: ["font-style: italic", "color: #5a5a5a"],
      a: ["color: #C15F3C", "font-weight: 500"],
      blockquote: ["border-left: 4px solid #C15F3C", "border-radius: 8px"],
      ul: ["padding-left: 32px"],
      li: ["margin: 12px 0", "font-size: 15px"],
      hr: ["margin: 64px auto", "max-width: 240px"],
      code: ["background-color:#fbf6f4", "border: 1px solid #e8e6dc"],
      img: ["border-radius: 12px", "rgba(193, 95, 60, 0.12)"],
      table: ["font-size: 15px", "border-radius: 8px"],
      th: ["padding: 16px 20px", "border-bottom: 2px solid rgba(193, 95, 60, 0.2)"],
      td: ["padding: 16px 20px", "border-bottom: 1px solid rgba(193, 95, 60, 0.1)"],
      tr: ["border: none"],
    },
    inline: {
      paragraphColor: "rgb(43, 43, 43)", paragraphLineHeight: "1.75", quoteBorderLeft: "4px",
      tableFontSize: "15px", tableHeaderFontSize: "inherit", tableCellFontSize: "inherit", listColor: "rgb(43, 43, 43)",
      paragraphFontSize: "15px", hrHeight: "2px", linkWeight: "500", quoteFontSize: "15px", strongColor: "rgb(193, 95, 60)", rowBottomBorder: "", rowLineHeight: "",
    },
  },
  {
    id: "rico-wechat-apple",
    name: "Apple 极简",
    category: "技术阅读",
    source: "wechat-apple.js",
    values: {
      p: ["margin: 0 0 18px", "line-height: 1.8 !important"],
      h1: ["font-size: 28px", "border-bottom: 1px solid #e8e8ed"],
      h2: ["font-size: 22px", "border-left: 3px solid #06c"],
      h3: ["font-size: 18px", "font-weight: 700"],
      h4: ["font-size: 13px", "text-transform: uppercase"],
      h5: ["font-size: 15px", "text-transform: uppercase"],
      h6: ["font-size: 14px", "color: #86868b"],
      strong: ["font-weight: 600", "rgba(0,124,255,0.08)"],
      em: ["font-style: italic", "color: #6e6e73"],
      a: ["color: #06c", "rgba(0,102,204,0.3)"],
      blockquote: ["background-color: #f5f5f7", "border-radius: 10px"],
      ul: ["margin: 32px 0 24px", "padding-left: 18px"],
      li: ["margin: 8px 0", "font-size: 15px"],
      hr: ["height: 1px", "max-width: 48px"],
      code: ["font-family: \"SF Mono\"", "color: #43709d"],
      img: ["margin: 24px auto 32px", "border-radius: 8px"],
      table: ["margin: 14px 0", "font-size: 13.5px"],
      th: ["font-size: 12px", "letter-spacing: 0.03em"],
      td: ["border-top: 1px solid #e8e8ed", "color: #1d1d1f"],
      tr: ["border: none"],
    },
    inline: {
      paragraphColor: "rgb(29, 29, 31)", paragraphLineHeight: "1.8", quoteBackground: "rgb(245, 245, 247)",
      tableFontSize: "13.5px", tableHeaderFontSize: "12px", tableCellFontSize: "inherit", listColor: "rgb(29, 29, 31)",
      paragraphFontSize: "15px", hrHeight: "1px", linkWeight: "inherit", quoteFontSize: "14.5px", strongColor: "rgb(29, 29, 31)", rowBottomBorder: "", rowLineHeight: "",
    },
  },
  {
    id: "rico-latepost-depth",
    name: "编辑部红",
    category: "传统质感",
    source: "latepost-depth.js",
    values: {
      p: ["margin: 20px 0", "line-height: 1.9 !important"],
      h1: ["font-size: 32px", "border-left: 6px solid #db5e5e"],
      h2: ["font-size: 24px", "background-color: #db5e5e"],
      h3: ["font-size: 20px", "border-left: 4px solid #db5e5e"],
      h4: ["font-size: 18px", "border-left: 3px solid #ff5252"],
      h5: ["font-size: 17px", "color: #333"],
      h6: ["font-size: 16px", "color: #666"],
      strong: ["font-weight: 700", "background-color: rgba(211, 47, 47, 0.08)"],
      em: ["font-style: italic", "color: #666"],
      a: ["color: #db5e5e", "border-bottom: 1px solid #db5e5e"],
      blockquote: ["border-left: 4px solid #db5e5e", "background-color: #f5f5f5"],
      ul: ["list-style-type: disc", "padding-left: 28px"],
      li: ["margin: 12px 0", "line-height: 1.8 !important"],
      hr: ["height: 2px", "max-width: 200px"],
      code: ["padding: 3px 8px", "color: #db5e5e"],
      img: ["border: 2px solid #db5e5e", "rgba(211, 47, 47, 0.12)"],
      table: ["font-size: 16px", "border-radius: 6px"],
      th: ["background-color: #db5e5e", "color: #fff"],
      td: ["padding: 12px 16px", "border-bottom: 1px solid #e0e0e0"],
      tr: ["line-height:1.1"],
    },
    inline: {
      paragraphColor: "rgb(26, 26, 26)", paragraphLineHeight: "1.9", quoteBorderLeft: "4px",
      tableFontSize: "16px", tableHeaderFontSize: "inherit", tableCellFontSize: "inherit", listColor: "rgb(26, 26, 26)",
      paragraphFontSize: "inherit", hrHeight: "2px", linkWeight: "inherit", quoteFontSize: "16px", strongColor: "rgb(219, 94, 94)", rowBottomBorder: "1px", rowLineHeight: "1.1",
    },
  },
  {
    id: "rico-kami-paper",
    name: "Kami 紙",
    category: "传统质感",
    source: "kami-paper.js",
    values: {
      p: ["font-size: 15px", "line-height: 1.78 !important"],
      h1: ["font-size: 28px", "border-bottom: 2px solid #1B365D"],
      h2: ["font-size: 24px", "border-left: 4px solid #1B365D"],
      h3: ["font-size: 20px", "color: #1B365D"],
      h4: ["font-size: 18px", "color: #141413"],
      h5: ["font-size: 16px", "color: #3d3d3a"],
      h6: ["font-size: 15px", "color: #5e5d59"],
      strong: ["font-weight: 600", "color: #141413"],
      em: ["font-style: italic", "color: #5e5d59"],
      a: ["color: #1B365D", "border-bottom: 1px solid #1B365D"],
      blockquote: ["border-left: 2px solid #1B365D", "background-color: #faf9f5"],
      ul: ["margin: 16px 0", "padding-left: 24px"],
      li: ["margin: 8px 0", "line-height: 1.75 !important"],
      hr: ["margin: 44px 0", "border-top: 1px solid #d7d3c6"],
      code: ["font-size: 13px", "color: #1B365D"],
      img: ["max-height: 400px", "border: 1px solid #e0ddd2"],
      table: ["margin: 24px 0", "font-size: 14px"],
      th: ["background-color: #E4ECF5", "border: 1px solid #d8d4c9"],
      td: ["background-color: #FAF9F5", "border: 1px solid #d8d4c9"],
      tr: ["border-bottom: 1px solid #d8d4c9"],
    },
    inline: {
      paragraphColor: "rgb(61, 61, 58)", paragraphLineHeight: "1.78", quoteBackground: "rgb(250, 249, 245)",
      tableFontSize: "14px", tableHeaderFontSize: "inherit", tableCellFontSize: "inherit", listColor: "rgb(61, 61, 58)",
      paragraphFontSize: "15px", hrHeight: "auto", linkWeight: "inherit", quoteFontSize: "inherit", strongColor: "rgb(20, 20, 19)", rowBottomBorder: "1px", rowLineHeight: "",
    },
  },
];

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

const sampleHtml =
  '<h1>Title</h1><h2>Heading</h2><h3>Detail</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6><p>Body <strong>strong</strong> <em>emphasis <strong>em strong</strong></em> <a href="/source">link</a> <code>api</code> <del>deleted</del></p><blockquote><p>Quote</p></blockquote><ul><li><p>Item</p></li><li><section>Wrapped</section></li></ul><ol><li>Ordered</li></ol><hr><figure><img src="image.png"><figcaption>Caption</figcaption></figure><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>';

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("Rico MD element-theme fidelity contract", () => {
  it("records the fixed Rico provenance, MIT notice, source map mode, and historical registration order", () => {
    expect(RICO_THEMES.map((theme) => theme.id)).toEqual([
      "rico-minimalism",
      "rico-wechat-anthropic",
      "rico-wechat-apple",
      "rico-latepost-depth",
      "rico-kami-paper",
    ]);

    RICO_CONTRACTS.forEach((contract, index) => {
      const theme = RICO_THEMES[index];
      expect(theme).toMatchObject({
        id: contract.id,
        name: contract.name,
        category: contract.category,
        author: "Rico (ricoui.com)",
        source: SOURCE_PREFIX + contract.source,
        license: "MIT",
        mode: "element-map",
      });
      expect(theme.styles).toHaveProperty("pre");
      expect(theme.styles).toMatchObject({
        "li > section": "margin: 0; font-weight: inherit; text-align: inherit;",
        figure: "margin: 0;",
        figcaption: "margin: 0; text-align: initial; color: inherit; font-size: inherit;",
        "table tr:nth-child(2n)": "background-color: transparent;",
      });
    });
  });

  it("locks every source element category while omitting only Rico pre styles from Plainly's fenced-code CSS", () => {
    RICO_CONTRACTS.forEach((contract) => {
      const theme = RICO_THEMES.find((item) => item.id === contract.id);
      const css = themeRegistry.resolveThemeCss(contract.id) || "";

      expect(theme).toBeDefined();
      Object.keys(contract.values).forEach((selector) => {
        const declarations = theme?.styles[selector] || "";
        contract.values[selector].forEach((expected) => expect(declarations).toContain(expected));
      });
      expect(css).toContain("#nice figure { margin: 0; }");
      expect(css).toContain("#nice table tr:nth-child(2n) { background-color: transparent; }");
      expect(css).not.toMatch(/#nice\s+pre\b|\.hljs|code-snippet__/i);
      expect(themeRegistry.resolveThemeHtml(contract.id, sampleHtml)).toBe(sampleHtml);
    });
  });

  it("inlines source paragraph, quote, list, image, and table values after BASIC_THEME without zebra leakage", () => {
    RICO_CONTRACTS.forEach((contract) => {
      const theme = RICO_THEMES.find((item) => item.id === contract.id);
      const css = themeRegistry.resolveThemeCss(contract.id) || "";
      const root = toRoot(juice.inlineContent(`<section id="nice">${sampleHtml}</section>`, BASIC_THEME_CSS + css));
      document.body.appendChild(root);
      const container = root.querySelector("#nice") as HTMLElement;
      const paragraph = root.querySelector("#nice > p") as HTMLElement;
      const quote = root.querySelector("blockquote") as HTMLElement;
      const quoteParagraph = quote.querySelector("p") as HTMLElement;
      const nestedItemParagraph = root.querySelector("li > p") as HTMLElement;
      const item = root.querySelector("ol li") as HTMLElement;
      const wrappedItem = root.querySelector("li > section") as HTMLElement;
      const code = paragraph.querySelector("code") as HTMLElement;
      const link = paragraph.querySelector("a") as HTMLElement;
      const deleted = paragraph.querySelector("del") as HTMLElement;
      const emphasizedStrong = paragraph.querySelector("em strong") as HTMLElement;
      const hr = root.querySelector("hr") as HTMLElement;
      const image = root.querySelector("img") as HTMLElement;
      const figure = root.querySelector("figure") as HTMLElement;
      const table = root.querySelector("table") as HTMLElement;
      const header = root.querySelector("th") as HTMLElement;
      const cell = root.querySelector("td") as HTMLElement;
      const stripedRow = root.querySelectorAll("tr")[1] as HTMLElement;
      const baseRow = root.querySelector("tr") as HTMLElement;
      const headerPadding = theme?.styles.th.match(/padding:\s*([^;]+)/)?.[1].split(" ") || [];
      const cellPadding = theme?.styles.td.match(/padding:\s*([^;]+)/)?.[1].split(" ") || [];

      expect(paragraph.style.color).toBe(contract.inline.paragraphColor);
      expect(paragraph.style.lineHeight).toBe(contract.inline.paragraphLineHeight);
      expect(paragraph.style.fontSize).toBe(contract.inline.paragraphFontSize);
      expect(paragraph.style.paddingTop).toBe("0px");
      expect(paragraph.style.paddingBottom).toBe("0px");
      expect(container.style.wordBreak).toBe("normal");
      expect(container.style.wordWrap).toBe("break-word");
      expect(quoteParagraph.style.color).toBe(contract.inline.paragraphColor);
      expect(nestedItemParagraph.style.lineHeight).toBe(contract.inline.paragraphLineHeight);
      expect(item.style.lineHeight).toBe(theme?.styles.li.match(/line-height:\s*([^;]+)/)?.[1].replace(" !important", ""));
      expect(wrappedItem.style.marginTop).toBe("0px");
      expect(wrappedItem.style.marginBottom).toBe("0px");
      expect(wrappedItem.style.fontWeight).toBe("inherit");
      expect(wrappedItem.style.textAlign).toBe("inherit");
      expect(wrappedItem.style.lineHeight).toBe(item.style.lineHeight);
      expect(wrappedItem.style.color).toBe(contract.inline.listColor);
      expect(code.style.marginTop).toBe("0px");
      expect(code.style.marginRight).toBe("0px");
      expect(code.style.wordWrap).toBe("inherit");
      expect(code.style.wordBreak).toBe("normal");
      expect(link.style.fontWeight).toBe(contract.inline.linkWeight);
      expect(deleted.style.fontStyle).toBe("inherit");
      expect(deleted.getAttribute("style")).toContain("color: inherit");
      if (deleted.style.textDecoration) expect(deleted.style.textDecoration).toContain("line-through");
      expect(emphasizedStrong.style.color).toBe(contract.inline.strongColor);
      expect(hr.style.height).toBe(contract.inline.hrHeight);
      expect(image.style.marginTop).not.toBe("");
      expect(figure.style.marginTop).toBe("0px");
      expect(header.style.paddingTop).toBe(headerPadding[0]);
      expect(cell.style.paddingLeft).toBe(cellPadding[1]);
      expect(table.style.fontSize).toBe(contract.inline.tableFontSize);
      expect(header.style.fontSize).toBe(contract.inline.tableHeaderFontSize);
      expect(cell.style.fontSize).toBe(contract.inline.tableCellFontSize);
      expect(stripedRow.style.backgroundColor).toBe("transparent");
      expect(window.getComputedStyle(baseRow).borderTopWidth || (baseRow.getAttribute("style")?.includes("border: none;") ? "0px" : "")).toBe("0px");
      expect(baseRow.style.backgroundColor).toBe("transparent");
      expect(baseRow.style.borderBottomWidth).toBe(contract.inline.rowBottomBorder);
      expect(baseRow.style.lineHeight).toBe(contract.inline.rowLineHeight);
      expect(quote.style.fontSize).toBe(contract.inline.quoteFontSize);
      expect(quote.style.overflow).toBe("visible");
      if (contract.inline.quoteBackground) expect(quote.style.backgroundColor).toBe(contract.inline.quoteBackground);
      if (contract.inline.quoteBorderLeft) expect(quote.style.borderLeftWidth).toBe(contract.inline.quoteBorderLeft);
    });
    const latepostCss = themeRegistry.resolveThemeCss("rico-latepost-depth") || "";
    const latepost = toRoot(juice.inlineContent(`<section id="nice">${sampleHtml}</section>`, BASIC_THEME_CSS + latepostCss));

    expect((latepost.querySelector("#nice") as HTMLElement).style.fontSize).toBe("17px");
    expect((latepost.querySelector("#nice > p") as HTMLElement).style.fontSize).toBe("inherit");
  });

  it("keeps standard and WeChat parser preview/export paths, Mermaid, MathJax, and fenced code independent for every Rico theme", () => {
    RICO_CONTRACTS.forEach((contract) => {
      (["standard", "wechat"] as Array<"standard" | "wechat">).forEach((parserMode) => {
        document.head.innerHTML = "";
        document.body.innerHTML = "";
        const {rawHtml, preview, exportHtml} = renderThemePreview(contract.id, TECH_DEPTH_TECHNICAL_ARTICLE, parserMode);
        const raw = toRoot(rawHtml);
        const codeSelector = parserMode === "standard" ? "pre.custom" : ".code-snippet__fix";

        expect(preview.querySelector("p code")?.textContent).toBe("ThemeRegistry");
        expect(preview.querySelector("figure img")?.getAttribute("src")).toBe("https://example.com/theme-preview.png");
        expect(preview.querySelector(`${codeSelector} code`)?.outerHTML).toBe(raw.querySelector(`${codeSelector} code`)?.outerHTML);
        expect(preview.querySelector(".mermaid")?.textContent).toBe(raw.querySelector(".mermaid")?.textContent);
        const exported = toRoot(exportHtml());
        expect(exported.querySelector("p code")?.getAttribute("style")).not.toContain("rgba(27, 31, 35, 0.05)");
        expect(exported.querySelector("figure img")?.getAttribute("style")).toContain("display: block");
        expect(exported.querySelector("th")?.getAttribute("style")).not.toContain("padding: 5px 10px");
        expect(exported.querySelector(codeSelector)).not.toBeNull();
        expect(exported.querySelector(".mermaid")?.textContent).toContain("Markdown --> Preview");
      });
    });
  });
});
