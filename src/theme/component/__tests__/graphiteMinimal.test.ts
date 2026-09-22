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

const transform = (html: string) => themeRegistry.resolveThemeHtml(GRAPHITE_MINIMAL_THEME.id, html);

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

describe("石墨极简 Rico fidelity contract", () => {
  it("declares Rico MD gzh-design-skill provenance and preserves historical indexes", () => {
    const themes = getThemeList();

    expect(GRAPHITE_MINIMAL_THEME).toMatchObject({
      id: "plainly-graphite-minimal",
      name: "石墨极简",
      category: "极简阅读",
      author: "Jiamu × Moyu Xiaoli",
      source: "ricocc/rico-md: assets/styles/themes/gzh/graphite-minimal.js",
      license: "AGPL-3.0-or-later",
      isNew: true,
      mode: "component",
    });
    expect(themes.findIndex((theme) => theme.id === "normal")).toBe(0);
    expect(themes.slice(21, 26).map((theme) => theme.id)).toEqual(RICO_THEMES.map((theme) => theme.id));
    expect(themes.findIndex((theme) => theme.id === TECH_DEPTH_THEME.id)).toBe(26);
    expect(themes.findIndex((theme) => theme.id === GRAPHITE_MINIMAL_THEME.id)).toBe(27);
    expect(themes.findIndex((theme) => theme.id === ZEN_WHITESPACE_THEME.id)).toBe(28);
  });

  it("keeps Rico's unwrapped H1/H3 and watermark H2 chapter structure with inline descendants", () => {
    const root = toRoot(
      transform(
        '<h1>Article <em>title</em></h1><h2><strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code></h2><h2>Last | AFTERWORD</h2><h3>Detail</h3>',
      ),
    );

    expect(root.querySelector("h1")?.innerHTML).toBe("Article <em>title</em>");
    expect(root.querySelector(".plainly-graphite-minimal-title")).toBeNull();
    expect(root.querySelectorAll(".plainly-graphite-minimal-chapter")).toHaveLength(2);
    expect(root.querySelectorAll(".plainly-graphite-minimal-chapter-number")[0].textContent).toBe("01");
    expect(root.querySelectorAll(".plainly-graphite-minimal-chapter-number")[1].textContent).toBe("∞");
    expect(root.querySelector(".plainly-graphite-minimal-chapter-label")?.textContent).toBe("AFTERWORD");
    expect(root.querySelector(".plainly-graphite-minimal-chapter h2")?.innerHTML).toBe(
      '<strong>First</strong> <em>section</em> <a href="/source">source</a> <code>api</code>',
    );
    expect(root.querySelector("h3")?.textContent).toBe("Detail");
    expect(root.querySelector("h3")?.parentElement?.className).not.toContain("subsection");
  });

  it("inserts Rico's three-card 本文看点 table of contents only for three or more chapters", () => {
    const root = toRoot(transform("<h2>First | INTRO</h2><h2>Second</h2><h2>Third</h2><h2>Fourth</h2>"));

    expect(root.querySelectorAll(".plainly-graphite-minimal-toc")).toHaveLength(1);
    expect(root.querySelector(".plainly-graphite-minimal-toc-label")?.textContent).toBe("本文看点");
    expect(root.querySelectorAll(".plainly-graphite-minimal-toc-card, .plainly-graphite-minimal-toc-card-last")).toHaveLength(3);
    expect(root.querySelectorAll(".plainly-graphite-minimal-toc-number")[2].textContent).toBe("03");
    expect(root.querySelectorAll(".plainly-graphite-minimal-toc-title")[0].textContent).toBe("First");
    expect(root.querySelectorAll(".plainly-graphite-minimal-toc-title")[2].textContent).toBe("Third");
  });

  it("matches Rico's QUOTE card, ordinary quote, list rows, and first-versus-last divider", () => {
    const root = toRoot(
      transform(
        '<blockquote><p>Preface <strong>note</strong></p><p>—— Rico</p></blockquote><h2>Chapter</h2><blockquote><p>Evidence</p><p>Second</p></blockquote><ul><li>Focus：<em>Nested</em><ul data-nested="yes"><li>child</li></ul></li></ul><ol start="4"><li>Ordered<ul data-nested="yes"><li>child</li></ul></li></ol><hr><hr>',
      ),
    );

    expect(root.querySelector(".plainly-graphite-minimal-intro-quote-label")?.textContent).toBe("QUOTE");
    expect(root.querySelector(".plainly-graphite-minimal-intro-quote-line strong")?.textContent).toBe("note");
    expect(root.querySelector(".plainly-graphite-minimal-intro-quote-signature")?.textContent).toBe("—— Rico");
    expect(root.querySelectorAll(".plainly-graphite-minimal-quote > p")).toHaveLength(2);
    expect(root.querySelector(".plainly-graphite-minimal-pill")?.textContent).toBe("Focus");
    expect(root.querySelector(".plainly-graphite-minimal-unordered-row > ul")?.getAttribute("data-nested")).toBe("yes");
    expect(root.querySelector(".plainly-graphite-minimal-ordered-marker")?.textContent).toBe("1");
    expect(root.querySelector(".plainly-graphite-minimal-ordered-row > ul")?.getAttribute("data-nested")).toBe("yes");
    expect(root.querySelectorAll(".plainly-graphite-minimal-divider-line")).toHaveLength(1);
    expect(root.querySelector(".plainly-graphite-minimal-divider-end-label")?.textContent).toBe("END");
    expect(root.querySelectorAll(".plainly-graphite-minimal-divider-end-line > span[leaf]")).toHaveLength(2);
  });

  it("leaves fenced code, Mermaid, MathJax, SVG, figures, and captions structurally untouched", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg><figure><img src="image.png"><figcaption>caption</figcaption></figure>';

    const root = toRoot(transform(html));

    expect(root.querySelector("pre")?.outerHTML).toBe(toRoot(html).querySelector("pre")?.outerHTML);
    expect(root.querySelector("pre.mermaid")?.outerHTML).toBe(toRoot(html).querySelector("pre.mermaid")?.outerHTML);
    expect(root.querySelector("mjx-container svg path")?.getAttribute("d")).toBe("M0 0");
    expect(root.querySelectorAll("svg path")[1]?.getAttribute("d")).toBe("M1 1");
    expect(root.querySelector("figure figcaption")?.textContent).toBe("caption");
    expect(themeRegistry.resolveThemeCss(GRAPHITE_MINIMAL_THEME.id)).not.toMatch(/#nice\s+pre\b|\.hljs|code-snippet__/i);
  });

  it("locks Rico CSS values for typography, cards, list markers, dividers, images, and table", () => {
    const css = themeRegistry.resolveThemeCss(GRAPHITE_MINIMAL_THEME.id);

    expect(css).toContain("padding: 8px 0 32px");
    expect(css).toContain("font-size: 15px; line-height: 1.8; text-align: justify; color: #52525b");
    expect(css).toContain("font-size: 22px; font-weight: 800; line-height: 1.4; color: #27272a");
    expect(css).toContain("font-size: 48px; font-weight: 900; line-height: 1; letter-spacing: -2px");
    expect(css).toContain("padding: 32px 24px 24px; border-top: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7");
    expect(css).toContain("border-left: 3px solid #52525b");
    expect(css).toContain("width: 22px; height: 22px");
    expect(css).toContain("width: 48px; height: 1px; background: #e4e4e7");
    expect(css).toContain("margin: 24px auto; border: 1px solid #e4e4e7; border-radius: 0");
    expect(css).toContain("background-color: #27272a; color: #ffffff");
    expect(css).not.toMatch(/#nice figure|#nice figcaption|#nice\s+pre\b|\.hljs|code-snippet__/i);
  });

  it("inlines Rico paragraph, quote, divider, and table values while resetting conflicting BASIC_THEME table rules", () => {
    const transformed = transform(
      '<h2>Architecture</h2><blockquote><p>Evidence</p></blockquote><p>Body <a href="/source">source</a> <code>api</code></p><hr><hr><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>',
    );
    const html = juice.inlineContent(
      `<section id="nice">${transformed}</section>`,
      BASIC_THEME_CSS + (GRAPHITE_MINIMAL_THEME.css || ""),
    );
    const root = toRoot(html);
    const paragraph = root.querySelector("#nice > p") as HTMLElement;
    const quote = root.querySelector(".plainly-graphite-minimal-quote") as HTMLElement;
    const header = root.querySelector("th") as HTMLElement;
    const cell = root.querySelector("td") as HTMLElement;
    const stripedRow = root.querySelectorAll("tr")[1] as HTMLElement;

    expect(paragraph.style.fontSize).toBe("15px");
    expect(paragraph.style.lineHeight).toBe("1.8");
    expect(paragraph.style.paddingLeft).toBe("10px");
    expect(quote.style.borderLeftWidth).toBe("3px");
    expect((quote.querySelector("p") as HTMLElement).style.fontSize).toBe("16px");
    expect((root.querySelector(".plainly-graphite-minimal-divider-line") as HTMLElement).style.height).toBe("1px");
    expect(header.style.backgroundColor).toBe("rgb(39, 39, 42)");
    expect(header.style.borderLeftWidth).toBe("0px");
    expect(cell.style.borderLeftWidth).toBe("0px");
    expect(cell.style.borderBottomWidth).toBe("1px");
    expect(cell.style.color).toBe("rgb(82, 82, 91)");
    expect(stripedRow.style.backgroundColor).toBe("rgb(250, 250, 250)");
  });
});
