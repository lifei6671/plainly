import {moveChildren} from "../dom";
import {createComponentThemeTransform} from "../transformer";
import type {ComponentRenderContext} from "../types";
import {ThemeRegistry} from "../../registry";
import type {ComponentThemeDefinition} from "../../types";

declare const describe: any;
declare const it: any;
declare const expect: any;

const metadata = {name: "Test", category: "test", author: "Plainly", source: "test", license: "MIT"};

describe("component theme transformer", () => {
  it("renders direct H1, H2, and H3 blocks", () => {
    const transform = createComponentThemeTransform({
      h1: (source, context) => {
        const target = context.document.createElement("header");
        target.dataset.rendered = "h1";
        moveChildren(source, target);
        return target;
      },
      h2: (source, context) => {
        const target = context.document.createElement("section");
        target.dataset.rendered = "h2";
        moveChildren(source, target);
        return target;
      },
      h3: (source, context) => {
        const target = context.document.createElement("div");
        target.dataset.rendered = "h3";
        moveChildren(source, target);
        return target;
      },
    });

    expect(transform("<h1>One</h1><h2>Two</h2><h3>Three</h3>")).toBe(
      '<header data-rendered="h1">One</header><section data-rendered="h2">Two</section><div data-rendered="h3">Three</div>',
    );
  });

  it("uses deterministic top-level block, tag, and H2 indexes", () => {
    const contexts: Array<{tag: string; blockIndex: number; tagIndex: number; heading2Index: number}> = [];
    const capture = (tag: string) => (_source: Element, context: ComponentRenderContext) => {
      contexts.push({tag, blockIndex: context.blockIndex, tagIndex: context.tagIndex, heading2Index: context.heading2Index});
    };
    const transform = createComponentThemeTransform({h1: capture("h1"), h2: capture("h2"), h3: capture("h3")});

    transform("<h1>One</h1><p>Paragraph</p><h2>Two</h2><h3>Three</h3><h2>Four</h2><h3>Five</h3>");

    expect(contexts).toEqual([
      {tag: "h1", blockIndex: 1, tagIndex: 1, heading2Index: 0},
      {tag: "h2", blockIndex: 3, tagIndex: 1, heading2Index: 1},
      {tag: "h3", blockIndex: 4, tagIndex: 1, heading2Index: 1},
      {tag: "h2", blockIndex: 5, tagIndex: 2, heading2Index: 2},
      {tag: "h3", blockIndex: 6, tagIndex: 2, heading2Index: 2},
    ]);
  });

  it("moves real inline descendants without rebuilding them as text", () => {
    const transform = createComponentThemeTransform({
      h2: (source, context) => {
        const target = context.document.createElement("section");
        moveChildren(source, target);
        return target;
      },
    });

    expect(transform('<h2><strong>Bold</strong> <em>Em</em> <a href="/link">Link</a> <code>code</code></h2>')).toBe(
      '<section><strong>Bold</strong> <em>Em</em> <a href="/link">Link</a> <code>code</code></section>',
    );
  });

  it("leaves unregistered and special blocks intact", () => {
    const transform = createComponentThemeTransform({
      h1: (source, context) => {
        const target = context.document.createElement("header");
        moveChildren(source, target);
        return target;
      },
    });
    const html =
      '<p>Paragraph</p><pre><code>const value = 1;</code></pre><pre class="mermaid">graph TD;</pre><mjx-container><svg><path d="M0 0"></path></svg></mjx-container><svg><path d="M1 1"></path></svg>';

    expect(transform(html)).toBe(html);
  });

  it("does not automatically transform nested list or heading blocks", () => {
    const calls: string[] = [];
    const transform = createComponentThemeTransform({
      ul: (source, context) => {
        calls.push(`ul:${context.blockIndex}`);
        const target = context.document.createElement("section");
        moveChildren(source, target);
        return target;
      },
      h2: (source, context) => {
        calls.push(`h2:${context.blockIndex}`);
        const target = context.document.createElement("h2");
        moveChildren(source, target);
        return target;
      },
    });

    expect(transform("<ul><li>Outer<ul><li>Nested</li></ul><h2>Nested heading</h2></li></ul><h2>Top heading</h2>")).toBe(
      "<section><li>Outer<ul><li>Nested</li></ul><h2>Nested heading</h2></li></section><h2>Top heading</h2>",
    );
    expect(calls).toEqual(["ul:1", "h2:2"]);
  });

  it("keeps the original block when a renderer returns undefined", () => {
    const transform = createComponentThemeTransform({p: () => undefined});

    expect(transform("<p>Keep me</p>")).toBe("<p>Keep me</p>");
  });

  it("expands a DocumentFragment into multiple sibling nodes", () => {
    const transform = createComponentThemeTransform({
      h1: (_source, context) => {
        const fragment = context.document.createDocumentFragment();
        const before = context.document.createElement("span");
        before.textContent = "before";
        const after = context.document.createElement("span");
        after.textContent = "after";
        fragment.append(before, after);
        return fragment;
      },
    });

    expect(transform("<h1>Title</h1>")).toBe("<span>before</span><span>after</span>");
  });

  it("integrates with ThemeRegistry after Phase 2A normalization", () => {
    const theme: ComponentThemeDefinition = {
      id: "component-test",
      ...metadata,
      mode: "component",
      transform: createComponentThemeTransform({
        h2: (source, context) => {
          const target = context.document.createElement("section");
          moveChildren(source, target);
          return target;
        },
      }),
    };

    expect(
      new ThemeRegistry([theme]).resolveThemeHtml(
        "component-test",
        '<h2><span class="prefix"></span><span class="content"><strong>Title</strong></span><span class="suffix"></span></h2>',
      ),
    ).toBe("<section><strong>Title</strong></section>");
  });
});
