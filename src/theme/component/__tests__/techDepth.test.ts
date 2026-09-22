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
import {TECH_DEPTH_THEME} from "../themes";

const transform = (html: string) => themeRegistry.resolveThemeHtml(TECH_DEPTH_THEME.id, html);

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("技术深读 component theme", () => {
  it("declares its metadata and appends after all existing themes", () => {
    const themes = getThemeList();
    const techDepthIndex = themes.findIndex((theme) => theme.id === TECH_DEPTH_THEME.id);

    expect(TECH_DEPTH_THEME).toMatchObject({
      id: "plainly-tech-depth",
      name: "技术深读",
      category: "技术阅读",
      author: "Plainly",
      source: "lifei6671/plainly",
      license: "GPL-3.0",
      isNew: true,
      mode: "component",
    });
    expect(themes.findIndex((theme) => theme.id === "normal")).toBe(0);
    expect(themes.findIndex((theme) => theme.id === "rico-minimalism")).toBe(21);
    expect(techDepthIndex).toBe(26);
    expect(themes.slice(techDepthIndex - RICO_THEMES.length, techDepthIndex).map((theme) => theme.id)).toEqual(
      RICO_THEMES.map((theme) => theme.id),
    );
    expect(themes[techDepthIndex]).toBe(TECH_DEPTH_THEME);
  });

  it("transforms H1, H2, and H3 while preserving real inline descendants", () => {
    const root = toRoot(
      transform(
        '<h1>Article <em>title</em></h1><h2><strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code></h2><h2>Second</h2><h3>Detail</h3>',
      ),
    );

    expect(root.querySelector(".plainly-tech-depth-title-text")?.innerHTML).toBe("Article <em>title</em>");
    expect(root.querySelectorAll(".plainly-tech-depth-section-number")[0].textContent).toBe("01");
    expect(root.querySelectorAll(".plainly-tech-depth-section-number")[1].textContent).toBe("02");
    expect(root.querySelector(".plainly-tech-depth-section-title")?.innerHTML).toBe(
      '<strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code>',
    );
    expect(root.querySelector(".plainly-tech-depth-subsection-marker")?.getAttribute("aria-hidden")).toBe("true");
    expect(root.querySelector(".plainly-tech-depth-subsection-title")?.textContent).toBe("Detail");
  });

  it("moves quote and list DOM intact and makes a text-free divider", () => {
    const root = toRoot(
      transform(
        '<blockquote><p>Research <strong>note</strong></p></blockquote><ul data-kind="unordered"><li>Outer<ul data-nested="yes"><li><em>Nested</em></li></ul></li></ul><ol start="4"><li>Ordered</li></ol><hr>',
      ),
    );
    const lists = root.querySelectorAll(".plainly-tech-depth-list");

    expect(root.querySelector(".plainly-tech-depth-quote p strong")?.textContent).toBe("note");
    expect(lists[0].querySelector("ul")?.getAttribute("data-kind")).toBe("unordered");
    expect(lists[0].querySelector("ul ul")?.getAttribute("data-nested")).toBe("yes");
    expect(lists[0].querySelectorAll(".plainly-tech-depth-list")).toHaveLength(0);
    expect(lists[1].querySelector("ol")?.getAttribute("start")).toBe("4");
    expect(root.querySelector(".plainly-tech-depth-divider")?.textContent).toBe("");
  });

  it("leaves fenced code, Mermaid, MathJax, and SVG structure untouched", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg>';

    expect(transform(html)).toBe(html);
  });

  it("scopes export-safe component CSS without taking over fenced code", () => {
    const css = themeRegistry.resolveThemeCss(TECH_DEPTH_THEME.id);
    const selectors = (css?.match(/[^{}]+(?=\{)/g) || [])
      .map((selector) => selector.trim())
      .filter((selector) => selector && !selector.startsWith("@"))
      .flatMap((selector) => selector.split(",").map((part) => part.trim()));

    expect(css).toEqual(expect.any(String));
    expect(css?.trim().length).toBeGreaterThan(0);
    expect(selectors.every((selector) => selector.startsWith("#nice"))).toBe(true);
    expect(css).toContain("plainly-tech-depth-section-number");
    expect(css).not.toMatch(/var\(|@media|@keyframes|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
    expect(css).not.toMatch(/#nice\s+code\s*\{/);
  });

  it("normalizes Plainly preview markup before component rendering", () => {
    const heading = toRoot(
      transform(
        '<h2><span class="prefix"></span><span class="content"><strong>Normalized</strong></span><span class="suffix"></span></h2>',
      ),
    );
    const list = toRoot(transform("<ul><li><section><strong>First</strong><ul><li><section>Nested</section></li></ul></section></li></ul>"));

    expect(heading.querySelector(".plainly-tech-depth-section-title")?.innerHTML).toBe("<strong>Normalized</strong>");
    expect(list.querySelector(".plainly-tech-depth-list ul > li > strong")?.textContent).toBe("First");
    expect(list.querySelector(".plainly-tech-depth-list ul ul li")?.textContent).toBe("Nested");
  });

  it("inlines component and basic-CSS overrides for export", () => {
    const transformed = transform(
      '<h2>Architecture</h2><blockquote><p>Evidence</p></blockquote><p>Body <a href="/source">source</a> <code>api</code></p><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>',
    );
    const html = juice.inlineContent(`<section id="nice">${transformed}</section>`, BASIC_THEME_CSS + (TECH_DEPTH_THEME.css || ""));
    const root = toRoot(html);
    const paragraph = root.querySelector("p") as HTMLElement;
    const link = root.querySelector("p a") as HTMLElement;
    const header = root.querySelector("th") as HTMLElement;
    const cell = root.querySelector("td") as HTMLElement;
    const stripedRow = root.querySelectorAll("tr")[1] as HTMLElement;

    expect(root.querySelector(".plainly-tech-depth-section-number")?.getAttribute("style")).toContain("background-color");
    expect(root.querySelector(".plainly-tech-depth-section-title")?.getAttribute("style")).toContain("font-size");
    expect(root.querySelector(".plainly-tech-depth-quote")?.getAttribute("style")).toContain("border-left");
    expect(paragraph.style.paddingTop).toBe("0px");
    expect(paragraph.style.paddingBottom).toBe("0px");
    expect(link.style.fontWeight).toBe("500");
    expect(header.style.paddingTop).toBe("10px");
    expect(header.style.borderTopWidth).toBe("1px");
    expect(header.style.backgroundColor).toBe("rgb(233, 240, 244)");
    expect(header.style.fontSize).toBe("14px");
    expect(cell.style.paddingLeft).toBe("12px");
    expect(cell.style.borderLeftWidth).toBe("1px");
    expect(cell.style.backgroundColor).toBe("rgb(255, 255, 255)");
    expect(cell.style.fontSize).toBe("14px");
    expect(stripedRow.style.backgroundColor).toBe("rgb(247, 250, 252)");
  });
});
