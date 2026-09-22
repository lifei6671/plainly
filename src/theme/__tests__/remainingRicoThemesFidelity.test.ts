/* eslint-disable import/first */
declare const describe: any;
declare const expect: any;
declare const it: any;
declare const jest: any;

jest.mock("../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

import juice from "juice";
import {GZH_REMAINING_COMPONENT_THEMES, GZH_REMAINING_SOURCE_THEMES} from "../component/themes/gzhRemaining";
import {RICO_REMAINING_ELEMENT_THEMES, RICO_REMAINING_SOURCE_THEMES} from "../rico/remainingThemes";
import {themeRegistry} from "../index";
import BASIC_THEME_CSS from "../../template/basic";
import {renderThemePreview, TECH_DEPTH_TECHNICAL_ARTICLE} from "../component/__tests__/themePreviewHarness";

const fixture = `<h1>标题</h1><h2>章节｜TAG</h2><h3>小节</h3><h4>四</h4><h5>五</h5><h6>六</h6><p><strong>强</strong><em>调</em><a href="/">链</a><code>x</code></p><blockquote><p>引语</p></blockquote><ul><li>项 <code>x</code></li></ul><ol><li>序项</li></ol><hr><figure><img src="x" alt="图"><figcaption>说明</figcaption></figure><table><thead><tr><th>头</th></tr></thead><tbody><tr><td>格</td></tr></tbody></table><pre><code>fenced</code></pre><svg><path></path></svg>`;

const paritySelectors: Record<string, string> = {
  p: "p", h1: "h1", h2: "h2", h3: "h3", blockquote: "blockquote", li: "ul > li", hr: "hr", code: "p code", img: "img", table: "table", th: "th", td: "td", tr: "tr",
};

const declaredStyle = (declarations: string) => {
  const element = document.createElement("div");
  element.setAttribute("style", declarations);
  return element.style;
};

const normalizedCssValue = (value: string) => value.replace(/["']/g, "\"").replace(/\s+/g, " ").trim();

const normalizedNode = (node: Node): unknown => {
  if (node.nodeType === Node.TEXT_NODE) return ["text", node.textContent];
  if (node.nodeType !== Node.ELEMENT_NODE) return [node.nodeType, node.textContent];
  const element = node as Element;
  return [
    element.tagName,
    Array.from(element.attributes)
      .map((attribute) => [attribute.name, attribute.name === "style" ? normalizedCssValue(attribute.value) : attribute.value])
      .sort(([left], [right]) => String(left).localeCompare(String(right))),
    Array.from(element.childNodes).map(normalizedNode),
  ];
};

const assertSourceDeclarationsWin = (source: Record<string, string>, finalRoot: Element) => {
  Object.entries(paritySelectors).forEach(([sourceSelector, finalSelector]) => {
    const declarations = source[sourceSelector];
    if (!declarations) return;
    const expected = declaredStyle(declarations);
    const finalElement = finalRoot.querySelector(finalSelector) as HTMLElement;
    expect(finalElement).not.toBeNull();
    for (let index = 0; index < expected.length; index += 1) {
      const property = expected.item(index);
      // jsdom drops unsupported/vendor declarations while parsing; only retained properties are comparable.
      if (!property || property.startsWith("-")) continue;
      expect(normalizedCssValue(finalElement.style.getPropertyValue(property))).toBe(
        normalizedCssValue(expected.getPropertyValue(property)),
      );
    }
  });
};

describe("remaining Rico MD theme fidelity contract", () => {
  it("appends every remaining theme after the frozen 0..28 range in Rico registration order", () => {
    expect(themeRegistry.getThemes().slice(29).map((theme) => theme.id)).toEqual([
      ...GZH_REMAINING_COMPONENT_THEMES.map((theme) => theme.id),
      ...RICO_REMAINING_ELEMENT_THEMES.map((theme) => theme.id),
    ]);
    expect(themeRegistry.getThemes()).toHaveLength(50);
  });

  it.each(RICO_REMAINING_ELEMENT_THEMES)("keeps $id as an MIT element-map with complete standard-element inline parity", (theme) => {
    expect(theme).toMatchObject({license: "MIT", mode: "element-map"});
    expect(theme.source).toContain(`assets/styles/themes/${theme.id.replace(/^rico-/, "")}.js`);
    const css = themeRegistry.resolveThemeCss(theme.id) || "";
    expect(css).toMatch(/#nice p/);
    expect(css).toMatch(/#nice h1/);
    expect(css).toMatch(/#nice table/);
    expect(css).not.toMatch(/#nice\s+pre\b/);
    const html = juice.inlineContent(`<section id="nice">${fixture}</section>`, BASIC_THEME_CSS + css);
    ["h1", "h2", "h3", "h4", "h5", "h6", "strong", "em", "a", "blockquote", "ul", "ol", "li", "hr", "code", "figure", "figcaption", "img", "table", "tr", "th", "td", "pre", "svg"].forEach((tag) => expect(html).toContain(`<${tag}`));
  });

  it("makes every explicit root source declaration win after Juice", () => {
    RICO_REMAINING_ELEMENT_THEMES.forEach((theme, index) => {
      const html = juice.inlineContent(`<section id="nice">${fixture}</section>`, BASIC_THEME_CSS + (themeRegistry.resolveThemeCss(theme.id) || ""));
      const root = document.createElement("div");
      root.innerHTML = html;
      assertSourceDeclarationsWin(RICO_REMAINING_SOURCE_THEMES[index].styles, root);
    });
  });

  it.each(GZH_REMAINING_COMPONENT_THEMES)("keeps $id as AGPL gzh component output without damaging inline or fenced descendants", (theme) => {
    expect(theme).toMatchObject({author: "Jiamu × Moyu Xiaoli", license: "AGPL-3.0-or-later", mode: "component"});
    expect(theme.source).toContain("assets/styles/themes/gzh/");
    const transformed = themeRegistry.resolveThemeHtml(theme.id, fixture);
    expect(transformed).toContain("<section");
    const root = document.createElement("div");
    root.innerHTML = transformed;
    expect(root.querySelector("strong")?.textContent).toBe("强");
    expect(root.querySelector("a")?.getAttribute("href")).toBe("/");
    expect(root.textContent).toContain("x");
    expect(root.querySelector("pre code")?.textContent).toBe("fenced");
    expect(root.querySelector("svg")).not.toBeNull();
    const html = juice.inlineContent(`<section id="nice">${transformed}</section>`, BASIC_THEME_CSS + (theme.css || ""));
    const inlined = document.createElement("div");
    inlined.innerHTML = html;
    expect(inlined.querySelector("table")).not.toBeNull();
    expect(inlined.querySelector("figcaption")?.textContent).toBe("说明");
  });

  it.each(GZH_REMAINING_COMPONENT_THEMES.map((theme, index) => ({theme, sourceTheme: GZH_REMAINING_SOURCE_THEMES[index]})))(
    "keeps $theme.id root container responsive to the available host width",
    ({theme, sourceTheme}) => {
      const {container} = sourceTheme.styles;

      expect(container).toContain("width:100%");
      expect(container).toContain("max-width:none");
      expect(theme.css).toMatch(/#nice\s*\{[^}]*width:100%;max-width:none;/);

      const root = document.createElement("div");
      root.innerHTML = juice.inlineContent(`<section id="nice"></section>`, BASIC_THEME_CSS + (theme.css || ""));
      expect((root.querySelector("#nice") as HTMLElement).style.width).toBe("100%");
      expect((root.querySelector("#nice") as HTMLElement).style.maxWidth).toBe("none");
    },
  );

  it("keeps source-line markers usable through legacy and Rico gzh component themes", () => {
    expect(themeRegistry.resolveThemeHtml("normal", '<h2 data-scroll-source-line="42">章节</h2>')).toContain(
      'data-scroll-source-line="42"',
    );

    const transformed = themeRegistry.resolveThemeHtml("plainly-gzh-moyu-green", '<h2 data-scroll-source-line="42">章节</h2>');
    const root = document.createElement("div");
    root.innerHTML = transformed;
    expect(root.querySelector('[data-scroll-source-line="42"]')?.textContent).toContain("章节");
  });

  it("matches the frozen gzh source transform exactly", () => {
    GZH_REMAINING_COMPONENT_THEMES.forEach((theme, index) => {
      const referenceDocument = document.implementation.createHTMLDocument("rico-reference");
      referenceDocument.body.innerHTML = fixture;
      GZH_REMAINING_SOURCE_THEMES[index].transform(referenceDocument, {fontScale: 1, displaySettings: {}});
      const plainly = document.createElement("div");
      plainly.innerHTML = themeRegistry.resolveThemeHtml(theme.id, fixture);
      expect(Array.from(plainly.childNodes).map(normalizedNode)).toEqual(Array.from(referenceDocument.body.childNodes).map(normalizedNode));
    });
  });

  it("keeps each copied Rico gzh transform's distinctive structure", () => {
    const markers = ["LAST", "END", "✂", "01", "· · ·"];
    GZH_REMAINING_COMPONENT_THEMES.forEach((theme, index) => {
      expect(themeRegistry.resolveThemeHtml(theme.id, fixture)).toContain(markers[index]);
    });
  });

  it.each([...GZH_REMAINING_COMPONENT_THEMES, ...RICO_REMAINING_ELEMENT_THEMES])(
    "runs $id through both production parser/preview/export modes",
    (theme) => {
      (["standard", "wechat"] as const).forEach((mode) => {
        const {rawHtml, preview, exportHtml} = renderThemePreview(theme.id, TECH_DEPTH_TECHNICAL_ARTICLE, mode === "wechat" ? "wechat" : undefined);
        const exported = exportHtml();
        expect(preview.querySelector("h1, h2, section")).not.toBeNull();
        expect(preview.textContent).toContain("ThemeRegistry");
        expect(preview.textContent).toContain("导出约束");
        expect(preview.textContent).toContain("嵌套无序项");
        expect(preview.querySelector("figure img, table")).not.toBeNull();
        expect(preview.querySelector(".mermaid")).not.toBeNull();
        expect(rawHtml).toContain(mode === "wechat" ? "code-snippet__fix" : "pre class=\"custom\"");
        expect(exported).toContain("Markdown --&gt; Preview");
        if (theme.mode === "component") {
          const code = preview.querySelector(mode === "wechat" ? ".code-snippet__fix" : "pre.custom");
          const raw = document.createElement("div");
          raw.innerHTML = rawHtml;
          const rawCode = raw.querySelector(mode === "wechat" ? ".code-snippet__fix" : "pre.custom");
          const codeWithoutPreviewMarker = code?.cloneNode(true) as Element;
          codeWithoutPreviewMarker?.removeAttribute("data-tool");
          expect(codeWithoutPreviewMarker?.outerHTML).toBe(rawCode?.outerHTML);
          const mermaidWithoutPreviewMarker = preview.querySelector(".mermaid")?.cloneNode(true) as Element;
          mermaidWithoutPreviewMarker?.removeAttribute("data-tool");
          expect(mermaidWithoutPreviewMarker?.outerHTML).toBe(raw.querySelector(".mermaid")?.outerHTML);
          expect(exported).toContain(mode === "wechat" ? "code-snippet__fix" : "pre class=\"custom\"");
          expect(code?.closest("ul, ol")).toBeNull();
        }
      });
    },
  );
});
