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
import {GRAPHITE_MINIMAL_THEME, TECH_DEPTH_THEME} from "../themes";

const transform = (html: string) => themeRegistry.resolveThemeHtml(GRAPHITE_MINIMAL_THEME.id, html);

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("石墨极简 component theme", () => {
  it("declares Plainly metadata and preserves every historical theme index", () => {
    const themes = getThemeList();

    expect(GRAPHITE_MINIMAL_THEME).toMatchObject({
      id: "plainly-graphite-minimal",
      name: "石墨极简",
      category: "极简阅读",
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
    expect(themes).toHaveLength(28);
  });

  it("transforms H1, numbered H2, and H3 while preserving inline descendants", () => {
    const root = toRoot(
      transform(
        '<h1>Article <em>title</em></h1><h2><strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code></h2><h2>Second</h2><h3>Detail</h3>',
      ),
    );

    expect(root.querySelector(".plainly-graphite-minimal-title-text")?.innerHTML).toBe("Article <em>title</em>");
    expect(root.querySelectorAll(".plainly-graphite-minimal-section-number")[0].textContent).toBe("01");
    expect(root.querySelectorAll(".plainly-graphite-minimal-section-number")[1].textContent).toBe("02");
    expect(root.querySelector(".plainly-graphite-minimal-section-title")?.innerHTML).toBe(
      '<strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code>',
    );
    expect(root.querySelector(".plainly-graphite-minimal-subsection-title")?.textContent).toBe("Detail");
  });

  it("moves quote, list, and divider DOM without wrapping nested lists twice", () => {
    const root = toRoot(
      transform(
        '<blockquote><p>Research <strong>note</strong></p></blockquote><ul data-kind="unordered"><li>Outer<ul data-nested="yes"><li><em>Nested</em></li></ul></li></ul><ol start="4"><li>Ordered</li></ol><hr>',
      ),
    );
    const lists = root.querySelectorAll(".plainly-graphite-minimal-list");

    expect(root.querySelector(".plainly-graphite-minimal-quote p strong")?.textContent).toBe("note");
    expect(lists[0].querySelector("ul")?.getAttribute("data-kind")).toBe("unordered");
    expect(lists[0].querySelector("ul ul")?.getAttribute("data-nested")).toBe("yes");
    expect(lists[0].querySelectorAll(".plainly-graphite-minimal-list")).toHaveLength(0);
    expect(lists[1].querySelector("ol")?.getAttribute("start")).toBe("4");
    expect(root.querySelector(".plainly-graphite-minimal-divider")?.textContent).toBe("");
  });

  it("leaves fenced code, Mermaid, MathJax, and SVG structure untouched", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg>';

    expect(transform(html)).toBe(html);
  });

  it("scopes export-safe CSS without taking over Code Theme selectors", () => {
    const css = themeRegistry.resolveThemeCss(GRAPHITE_MINIMAL_THEME.id);
    const selectors = (css?.match(/[^{}]+(?=\{)/g) || [])
      .map((selector) => selector.trim())
      .filter((selector) => selector && !selector.startsWith("@"))
      .flatMap((selector) => selector.split(",").map((part) => part.trim()));

    expect(css).toEqual(expect.any(String));
    expect(css?.trim().length).toBeGreaterThan(0);
    expect(selectors.every((selector) => selector.startsWith("#nice"))).toBe(true);
    expect(css).toContain("#52525b");
    expect(css).not.toMatch(/var\(|@media|@keyframes|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
    expect(css).not.toMatch(/#nice\s+pre\b|\.hljs|code-snippet__/i);
  });

  it("inlines graphite component and body styles for export", () => {
    const transformed = transform(
      '<h2>Architecture</h2><blockquote><p>Evidence</p></blockquote><p>Body <a href="/source">source</a> <code>api</code></p><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>',
    );
    const html = juice.inlineContent(`<section id="nice">${transformed}</section>`, BASIC_THEME_CSS + (GRAPHITE_MINIMAL_THEME.css || ""));
    const root = toRoot(html);
    const paragraph = root.querySelector("p") as HTMLElement;
    const link = root.querySelector("p a") as HTMLElement;
    const header = root.querySelector("th") as HTMLElement;
    const cell = root.querySelector("td") as HTMLElement;

    expect(root.querySelector(".plainly-graphite-minimal-section-number")?.getAttribute("style")).toContain("color");
    expect(root.querySelector(".plainly-graphite-minimal-section-title")?.getAttribute("style")).toContain("font-size");
    expect(root.querySelector(".plainly-graphite-minimal-quote")?.getAttribute("style")).toContain("background-color");
    expect(paragraph.style.paddingTop).toBe("0px");
    expect(link.style.color).toBe("rgb(82, 82, 91)");
    expect(header.style.backgroundColor).toBe("rgb(244, 244, 245)");
    expect(cell.style.borderLeftWidth).toBe("1px");
    expect(cell.style.color).toBe("rgb(63, 63, 70)");
  });
});
