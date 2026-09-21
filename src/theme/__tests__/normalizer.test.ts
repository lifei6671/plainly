import {normalizePlainlyHtml} from "../normalizer";
import {ThemeRegistry} from "../registry";
import {resolveThemeHtmlForTemplate} from "../templateResolver";
import type {ThemeDefinition} from "../types";

declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

const metadata = {name: "Test", category: "test", author: "Plainly", source: "test", license: "MIT"};

describe("Plainly theme DOM normalization", () => {
  it("passes through unknown and no-transform theme HTML byte-for-byte", () => {
    const html = '<h1><span class="prefix"></span><span class="content">Title</span><span class="suffix"></span></h1>';
    const legacy: ThemeDefinition = {id: "legacy", ...metadata, mode: "legacy-css", css: "h1 {}"};
    const registry = new ThemeRegistry([legacy]);

    expect(registry.resolveThemeHtml("missing", html)).toBe(html);
    expect(registry.resolveThemeHtml("legacy", html)).toBe(html);
  });

  it("normalizes heading markup once before the transform runs", () => {
    const transform = jest.fn((html: string) => `<article>${html}</article>`);
    const theme: ThemeDefinition = {id: "transform", ...metadata, mode: "element-map", styles: {}, transform};
    const registry = new ThemeRegistry([theme]);

    expect(
      registry.resolveThemeHtml(
        "transform",
        '<h2><span class="prefix"></span><span class="content"><strong>Bold</strong> <code>code</code></span><span class="suffix"></span></h2>',
      ),
    ).toBe("<article><h2><strong>Bold</strong> <code>code</code></h2></article>");
    expect(transform).toHaveBeenCalledTimes(1);
    expect(transform).toHaveBeenCalledWith("<h2><strong>Bold</strong> <code>code</code></h2>");
  });

  it("unwraps direct list item sections without losing inline or nested content", () => {
    const html = '<ul><li><section><strong>First</strong><ul><li><section><em>Nested</em></section></li></ul></section></li></ul>';

    expect(normalizePlainlyHtml(html)).toBe("<ul><li><strong>First</strong><ul><li><em>Nested</em></li></ul></li></ul>");
  });

  it("keeps a semantic section when its list item has other element children", () => {
    const html = "<ul><li><section>semantic</section><span>tail</span></li></ul>";

    expect(normalizePlainlyHtml(html)).toBe(html);
  });

  it("keeps a heading with an extra direct child unchanged", () => {
    const html =
      '<h2><span class="prefix"></span><span class="content">Title</span><span class="suffix"></span><span>tail</span></h2>';

    expect(normalizePlainlyHtml(html)).toBe(html);
  });

  it("leaves code, Mermaid, MathJax, and SVG content intact", () => {
    const html =
      '<pre><code class="language-ts">const value = 1;</code></pre><pre class="mermaid">graph TD; A--&gt;B;</pre><mjx-container jax="SVG"><svg viewBox="0 0 1 1"><path d="M0 0"></path></svg></mjx-container>';

    expect(normalizePlainlyHtml(html)).toBe(html);
  });

  it("uses the transform for the theme selected by template number", () => {
    const first: ThemeDefinition = {
      id: "first",
      ...metadata,
      mode: "element-map",
      styles: {},
      transform: (html) => `first:${html}`,
    };
    const second: ThemeDefinition = {
      id: "second",
      ...metadata,
      mode: "element-map",
      styles: {},
      transform: (html) => `second:${html}`,
    };
    const registry = new ThemeRegistry([first, second]);

    expect(resolveThemeHtmlForTemplate(registry, 0, "<p>value</p>")).toBe("first:<p>value</p>");
    expect(resolveThemeHtmlForTemplate(registry, 1, "<p>value</p>")).toBe("second:<p>value</p>");
  });
});
