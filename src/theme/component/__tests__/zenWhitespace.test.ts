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

describe("留白禅意 Rico fidelity contract", () => {
  it("declares the Rico MD gzh-design-skill provenance without claiming Plainly authorship", () => {
    const themes = getThemeList();

    expect(ZEN_WHITESPACE_THEME).toMatchObject({
      id: "plainly-zen-whitespace",
      name: "留白禅意",
      category: "随笔阅读",
      author: "Jiamu × Moyu Xiaoli",
      source: "ricocc/rico-md: assets/styles/themes/gzh/zen-whitespace.js",
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

  it("keeps Rico's real heading semantics: unwrapped H1/H3 and labeled H2 chapters", () => {
    const root = toRoot(
      transform(
        '<h1>Article <em>title</em></h1><h2><strong>First</strong> <em>section</em> <a href="/source">source</a></h2><h2>Last | AFTERWORD</h2><h3>Detail</h3><h4>H4</h4><h5>H5</h5><h6>H6</h6>',
      ),
    );

    expect(root.querySelector("h1")?.innerHTML).toBe("Article <em>title</em>");
    expect(root.querySelector(".plainly-zen-whitespace-title")).toBeNull();
    expect(root.querySelectorAll(".plainly-zen-whitespace-chapter")).toHaveLength(2);
    expect(root.querySelectorAll(".plainly-zen-whitespace-chapter-label")[0].textContent).toBe("01 · CHAPTER ONE");
    expect(root.querySelectorAll(".plainly-zen-whitespace-chapter-label")[1].textContent).toBe("∞ · POSTSCRIPT");
    expect(root.querySelector(".plainly-zen-whitespace-chapter h2")?.innerHTML).toBe(
      '<strong>First</strong> <em>section</em> <a href="/source">source</a>',
    );
    expect(root.querySelectorAll(".plainly-zen-whitespace-chapter-rule > span[leaf]")).toHaveLength(2);
    expect(root.querySelector("h3")?.textContent).toBe("Detail");
    expect(root.querySelector("h3")?.parentElement?.className).not.toContain("subsection");
  });

  it("matches Rico's preface quote, ordinary quote, list rows, and first-versus-last rule transform", () => {
    const root = toRoot(
      transform(
        '<blockquote><p>Preface <strong>note</strong></p><p>—— Rico</p></blockquote><h2>Chapter</h2><blockquote><p>Evidence</p><p>Second</p></blockquote><ul data-kind="unordered"><li>Outer<ul data-nested="yes"><li><em>Nested</em></li></ul></li></ul><ol start="4"><li>Ordered</li></ol><hr><hr>',
      ),
    );
    const lists = root.querySelectorAll(".plainly-zen-whitespace-list");

    expect(root.querySelector(".plainly-zen-whitespace-intro-quote-line strong")?.textContent).toBe("note");
    expect(root.querySelector(".plainly-zen-whitespace-intro-quote-signature")?.textContent).toBe("—— Rico");
    expect(root.querySelectorAll(".plainly-zen-whitespace-quote > p")).toHaveLength(2);
    expect(lists).toHaveLength(2);
    expect(lists[0].querySelectorAll(".plainly-zen-whitespace-list-row")).toHaveLength(1);
    expect(lists[0].querySelector(".plainly-zen-whitespace-list-marker")?.textContent).toBe("·");
    expect(lists[0].querySelector(".plainly-zen-whitespace-list-row > ul")?.getAttribute("data-nested")).toBe("yes");
    expect(lists[1].querySelector(".plainly-zen-whitespace-list-marker")?.textContent).toBe("01");
    expect(root.querySelectorAll(".plainly-zen-whitespace-divider-line")).toHaveLength(1);
    expect(root.querySelector(".plainly-zen-whitespace-divider-end-label")?.textContent).toBe("END");
    expect(root.querySelectorAll(".plainly-zen-whitespace-divider-end-line > span[leaf]")).toHaveLength(2);
  });

  it("inserts Rico's three-cell 本文脉络 table of contents only when there are at least three chapters", () => {
    const root = toRoot(transform("<h2>First | INTRO</h2><h2>Second</h2><h2>Third</h2><h2>Fourth</h2>"));

    expect(root.querySelectorAll(".plainly-zen-whitespace-toc")).toHaveLength(1);
    expect(root.querySelector(".plainly-zen-whitespace-toc-label")?.textContent).toBe("本文脉络");
    expect(root.querySelectorAll(".plainly-zen-whitespace-toc-cell")).toHaveLength(3);
    expect(root.querySelectorAll(".plainly-zen-whitespace-toc-number")[2].textContent).toBe("03");
    expect(root.querySelectorAll(".plainly-zen-whitespace-toc-title")[0].textContent).toBe("First");
    expect(root.querySelectorAll(".plainly-zen-whitespace-toc-title")[2].textContent).toBe("Third");
  });

  it("leaves fenced code, Mermaid, MathJax, and SVG structure for the independent Code Theme", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg>';

    expect(transform(html)).toBe(html);
    expect(themeRegistry.resolveThemeCss(ZEN_WHITESPACE_THEME.id)).not.toMatch(/#nice\s+pre\b|\.hljs|code-snippet__/i);
  });

  it("locks Rico CSS values for typography, quote, rules, images, and the border-only table", () => {
    const css = themeRegistry.resolveThemeCss(ZEN_WHITESPACE_THEME.id);

    expect(css).toContain("padding: 16px 0 40px");
    expect(css).toContain("font-size: 15px; line-height: 1.9; text-align: justify; color: #525252");
    expect(css).toContain("font-size: 22px; font-weight: 700; line-height: 1.4; color: #2b2b2b");
    expect(css).toContain("border-left: 3px solid #4a5d52");
    expect(css).toContain("padding: 36px 20px; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8");
    expect(css).toContain("height: 1px; margin: 64px 0 0; background: #e8e8e8");
    expect(css).toContain("width: 48px; height: 1px; background: #e8e8e8");
    expect(css).toContain("margin: 32px auto; border: 1px solid #e8e8e8; border-radius: 0");
    expect(css).toContain("border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8");
    expect(css).not.toMatch(/#nice figure|#nice figcaption|background-color:\s*#(?:edf2eb|f7f9f5|fffefb)/i);
  });

  it("inlines Rico paragraph, quote, divider, and table output without a header fill, cell grid, or zebra rows", () => {
    const transformed = transform(
      '<h2>Architecture</h2><blockquote><p>Evidence</p></blockquote><p>Body <a href="/source">source</a> <code>api</code></p><hr><hr><table><tbody><tr><th>Header</th><td>Cell</td></tr><tr><th>Next</th><td>Value</td></tr></tbody></table>',
    );
    const html = juice.inlineContent(
      `<section id="nice">${transformed}</section>`,
      BASIC_THEME_CSS + (ZEN_WHITESPACE_THEME.css || ""),
    );
    const root = toRoot(html);
    const paragraph = root.querySelector("#nice > p") as HTMLElement;
    const quote = root.querySelector(".plainly-zen-whitespace-quote") as HTMLElement;
    const firstRule = root.querySelector(".plainly-zen-whitespace-divider-line") as HTMLElement;
    const lastRule = root.querySelector(".plainly-zen-whitespace-divider-end") as HTMLElement;
    const header = root.querySelector("th") as HTMLElement;
    const cell = root.querySelector("td") as HTMLElement;
    const stripedRow = root.querySelectorAll("tr")[1] as HTMLElement;

    expect(paragraph.style.fontSize).toBe("15px");
    expect(paragraph.style.lineHeight).toBe("1.9");
    expect(paragraph.style.paddingLeft).toBe("16px");
    expect(quote.style.paddingTop).toBe("36px");
    expect(quote.style.borderTopWidth).toBe("1px");
    expect((quote.querySelector("p") as HTMLElement).style.fontFamily).toContain("Georgia");
    expect(firstRule.style.marginTop).toBe("64px");
    expect(lastRule.style.marginTop).toBe("48px");
    expect(header.style.paddingTop).toBe("12px");
    expect(header.style.borderLeftWidth).toBe("0px");
    expect(header.style.backgroundColor).toBe("transparent");
    expect(cell.style.borderLeftWidth).toBe("0px");
    expect(cell.style.backgroundColor).toBe("transparent");
    expect(cell.style.lineHeight).toBe("1.8");
    expect(stripedRow.style.backgroundColor).toBe("transparent");
  });
});
