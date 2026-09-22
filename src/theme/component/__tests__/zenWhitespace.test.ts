/* eslint-disable import/first */
declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

jest.mock("../../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

import juice from "juice";
import BASIC_THEME_CSS from "../../../template/basic";
import {getThemeList, themeRegistry} from "../..";
import {RICO_THEMES} from "../../rico/themes";
import {GRAPHITE_MINIMAL_THEME, TECH_DEPTH_THEME, ZEN_WHITESPACE_THEME} from "../themes";

const transform = (html: string) => themeRegistry.resolveThemeHtml(ZEN_WHITESPACE_THEME.id, html);

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("留白禅意 component theme", () => {
  it("declares Plainly metadata and appends after historical theme indices", () => {
    const themes = getThemeList();

    expect(ZEN_WHITESPACE_THEME).toMatchObject({
      id: "plainly-zen-whitespace",
      name: "留白禅意",
      category: "随笔阅读",
      author: "Plainly",
      source: "lifei6671/plainly",
      license: "GPL-3.0",
      isNew: true,
      mode: "component",
    });
    expect(themes.findIndex((theme) => theme.id === "normal")).toBe(0);
    expect(themes.slice(21, 26).map((theme) => theme.id)).toEqual(RICO_THEMES.map((theme) => theme.id));
    expect(themes.findIndex((theme) => theme.id === TECH_DEPTH_THEME.id)).toBe(26);
    expect(themes.findIndex((theme) => theme.id === GRAPHITE_MINIMAL_THEME.id)).toBe(27);
    expect(themes.findIndex((theme) => theme.id === ZEN_WHITESPACE_THEME.id)).toBe(28);
  });

  it("transforms H1, numbered H2, and anchored H3 while preserving inline descendants", () => {
    const root = toRoot(
      transform(
        '<h1>Article <em>title</em></h1><h2><strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code></h2><h2>Second</h2><h3>Detail</h3>',
      ),
    );

    expect(root.querySelector(".plainly-zen-whitespace-title-text")?.innerHTML).toBe("Article <em>title</em>");
    expect(root.querySelectorAll(".plainly-zen-whitespace-section-number")[0].textContent).toBe("01");
    expect(root.querySelectorAll(".plainly-zen-whitespace-section-number")[1].textContent).toBe("02");
    expect(root.querySelector(".plainly-zen-whitespace-section-title")?.innerHTML).toBe(
      '<strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code>',
    );
    expect(root.querySelector(".plainly-zen-whitespace-subsection-marker")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(".plainly-zen-whitespace-subsection-title")?.textContent).toBe("Detail");
  });

  it("moves quote, list, and divider DOM without wrapping nested lists twice", () => {
    const root = toRoot(
      transform(
        '<blockquote><p>Research <strong>note</strong></p></blockquote><ul data-kind="unordered"><li>Outer<ul data-nested="yes"><li><em>Nested</em></li></ul></li></ul><ol start="4"><li>Ordered</li></ol><hr>',
      ),
    );
    const lists = root.querySelectorAll(".plainly-zen-whitespace-list");

    expect(root.querySelector(".plainly-zen-whitespace-quote p strong")?.textContent).toBe("note");
    expect(lists[0].querySelector("ul")?.getAttribute("data-kind")).toBe("unordered");
    expect(lists[0].querySelector("ul ul")?.getAttribute("data-nested")).toBe("yes");
    expect(lists[0].querySelectorAll(".plainly-zen-whitespace-list")).toHaveLength(0);
    expect(lists[1].querySelector("ol")?.getAttribute("start")).toBe("4");
    expect(root.querySelector(".plainly-zen-whitespace-divider")?.textContent).toBe("");
  });

  it("leaves fenced code, Mermaid, MathJax, and SVG structure untouched", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg>';

    expect(transform(html)).toBe(html);
  });

  it("scopes export-safe CSS without taking over Code Theme selectors", () => {
    const css = themeRegistry.resolveThemeCss(ZEN_WHITESPACE_THEME.id);
    const selectors = (css?.match(/[^{}]+(?=\{)/g) || [])
      .map((selector) => selector.trim())
      .filter((selector) => selector && !selector.startsWith("@"))
      .flatMap((selector) => selector.split(",").map((part) => part.trim()));

    expect(css).toEqual(expect.any(String));
    expect(css?.trim().length).toBeGreaterThan(0);
    expect(selectors.every((selector) => selector.startsWith("#nice"))).toBe(true);
    expect(css).toMatch(/#4a5d52/i);
    expect(css).not.toMatch(/var\(|@media|@keyframes|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
    expect(css).not.toMatch(/#nice\s+pre\b|\.hljs|code-snippet__/i);
  });

  it("inlines spacious Zen styles for text, quote, lists, and table export", () => {
    const transformed = transform(
      '<h2>Architecture</h2><blockquote><p>Evidence</p></blockquote><ul><li>Quiet <strong>point</strong></li></ul><p>Body <a href="/source">source</a> <code>api</code></p><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>',
    );
    const html = juice.inlineContent(`<section id="nice">${transformed}</section>`, BASIC_THEME_CSS + (ZEN_WHITESPACE_THEME.css || ""));
    const root = toRoot(html);
    const paragraph = root.querySelector("p") as HTMLElement;
    const quote = root.querySelector(".plainly-zen-whitespace-quote") as HTMLElement;
    const list = root.querySelector(".plainly-zen-whitespace-list li") as HTMLElement;
    const header = root.querySelector("th") as HTMLElement;
    const cell = root.querySelector("td") as HTMLElement;

    expect(root.querySelector(".plainly-zen-whitespace-section-number")?.getAttribute("style")).toContain("color");
    expect(root.querySelector(".plainly-zen-whitespace-section-title")?.getAttribute("style")).toContain("font-size");
    expect(paragraph.style.paddingTop).toBe("0px");
    expect(quote.style.textAlign).toBe("center");
    expect(quote.style.fontFamily).toContain("Georgia");
    expect(list.style.lineHeight).toBe("1.95");
    expect(header.style.backgroundColor).toBe("rgb(237, 242, 235)");
    expect(cell.style.borderLeftWidth).toBe("1px");
    expect(cell.style.color).toBe("rgb(70, 86, 76)");
  });
});
