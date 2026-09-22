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

import {getThemeList} from "../..";
import {RICO_THEMES} from "../../rico/themes";
import {GRAPHITE_MINIMAL_THEME, TECH_DEPTH_THEME} from "../themes";
import {renderThemePreview, TECH_DEPTH_TECHNICAL_ARTICLE} from "./themePreviewHarness";

const toRoot = (html: string) => {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
};

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
});

describe("component theme production preview and WeChat export", () => {
  it("keeps the existing theme index contract", () => {
    const themes = getThemeList();
    const techDepthIndex = themes.findIndex((theme) => theme.id === TECH_DEPTH_THEME.id);
    const graphiteMinimalIndex = themes.findIndex((theme) => theme.id === GRAPHITE_MINIMAL_THEME.id);

    expect(themes.slice(0, 21).map((theme) => theme.id)).toEqual([
      "normal",
      "shanchui",
      "rose",
      "fullStackBlue",
      "nightPurple",
      "cuteGreen",
      "extremeBlack",
      "orangeHeart",
      "ink",
      "purple",
      "green",
      "cyan",
      "wechatFormat",
      "blueCyan",
      "blueMountain",
      "geekBlack",
      "red",
      "blue",
      "scienceBlue",
      "simple",
      "custom",
    ]);
    expect(themes.slice(21, techDepthIndex).map((theme) => theme.id)).toEqual(RICO_THEMES.map((theme) => theme.id));
    expect(techDepthIndex).toBe(26);
    expect(graphiteMinimalIndex).toBe(27);
    expect(themes[techDepthIndex]).toBe(TECH_DEPTH_THEME);
    expect(themes[graphiteMinimalIndex]).toBe(GRAPHITE_MINIMAL_THEME);
  });

  it("runs a real technical article through parser, component preview, and WeChat export", () => {
    const {rawHtml, previewHtml, preview, exportHtml} = renderThemePreview(
      TECH_DEPTH_THEME.id,
      TECH_DEPTH_TECHNICAL_ARTICLE,
    );
    const parsed = toRoot(rawHtml);

    expect(rawHtml).toContain('<h1><span class="prefix"></span><span class="content">从渲染管线理解主题迁移</span>');
    expect(rawHtml).toContain('<div class="mermaid">');
    expect(rawHtml).toContain('<pre class="custom"><code class="hljs">');
    expect(rawHtml).toContain("$O(n \\log n)$");

    expect(preview.querySelectorAll(".plainly-tech-depth-title")).toHaveLength(1);
    expect(preview.querySelectorAll(".plainly-tech-depth-section")).toHaveLength(1);
    expect(preview.querySelectorAll(".plainly-tech-depth-subsection")).toHaveLength(1);
    expect(preview.querySelector(".plainly-tech-depth-quote p")?.textContent).toContain("预览 DOM");
    expect(preview.querySelector(".plainly-tech-depth-section-number")?.textContent).toBe("01");
    expect(preview.querySelector(".plainly-tech-depth-section-title strong")?.textContent).toBe("渲染");
    expect(preview.querySelector(".plainly-tech-depth-section-title em")?.textContent).toBe("边界");
    expect(preview.querySelector(".plainly-tech-depth-section-title a")?.getAttribute("href")).toBe(
      "https://example.com/render-contract",
    );
    expect(preview.querySelector(".plainly-tech-depth-list ul ul li strong")?.textContent).toBe("强调");
    expect(preview.querySelectorAll(".plainly-tech-depth-list .plainly-tech-depth-list")).toHaveLength(0);
    expect(preview.querySelector(".plainly-tech-depth-list ol ol")).not.toBeNull();
    expect(preview.querySelector("p code")?.textContent).toBe("ThemeRegistry");
    expect(preview.querySelector("table tbody tr")?.textContent).toContain("H2 编号与行内节点保留");
    expect(preview.querySelector("figure img")?.getAttribute("src")).toBe("https://example.com/theme-preview.png");
    expect(preview.querySelector("pre.custom")?.outerHTML).toBe(parsed.querySelector("pre.custom")?.outerHTML);
    expect(preview.querySelector(".mermaid")?.outerHTML).toBe(parsed.querySelector(".mermaid")?.outerHTML);
    expect(previewHtml).toContain("$O(n \\log n)$");

    const exportedHtml = exportHtml();
    const exported = toRoot(exportedHtml);

    expect(exported.querySelectorAll(".plainly-tech-depth-section")).toHaveLength(1);
    expect(exported.querySelector(".plainly-tech-depth-title")?.getAttribute("data-tool")).toBe("mdnice编辑器");
    expect(exported.querySelector(".plainly-tech-depth-section-number")?.getAttribute("style")).toContain("background-color");
    expect(exported.querySelector(".plainly-tech-depth-section-title")?.getAttribute("style")).toContain("font-size");
    expect(exported.querySelector(".plainly-tech-depth-list ul ul")).not.toBeNull();
    expect(exported.querySelector("pre.custom > code.hljs")?.getAttribute("style")).toContain("background: #f8f8f8");
    expect(exported.querySelector(".mermaid")?.textContent).toContain("Markdown --> Preview");
    expect(exportedHtml).not.toMatch(/var\(|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
  });

  it("keeps WeChat parser code blocks and component structure through export", () => {
    const {rawHtml, preview, exportHtml} = renderThemePreview(
      TECH_DEPTH_THEME.id,
      TECH_DEPTH_TECHNICAL_ARTICLE,
      "wechat",
    );
    const parsed = toRoot(rawHtml);

    expect(rawHtml).toContain('class="code-snippet__fix code-snippet__js"');
    expect(preview.querySelectorAll(".plainly-tech-depth-title")).toHaveLength(1);
    expect(preview.querySelector(".plainly-tech-depth-section-number")?.textContent).toBe("01");
    expect(preview.querySelector(".plainly-tech-depth-list ul ul")).not.toBeNull();
    expect(preview.querySelector(".code-snippet__fix")?.outerHTML).toBe(parsed.querySelector(".code-snippet__fix")?.outerHTML);
    expect(preview.querySelector(".code-snippet__fix")?.closest(".plainly-tech-depth-list")).toBeNull();
    expect(preview.querySelector(".mermaid")?.outerHTML).toBe(parsed.querySelector(".mermaid")?.outerHTML);

    const exported = toRoot(exportHtml());

    expect(exported.querySelectorAll(".plainly-tech-depth-section")).toHaveLength(1);
    expect(exported.querySelector(".plainly-tech-depth-list ul ul")).not.toBeNull();
    expect(exported.querySelector(".code-snippet__fix")).not.toBeNull();
    expect(exported.querySelector(".code-snippet__fix")?.closest(".plainly-tech-depth-list")).toBeNull();
    expect(exported.querySelector(".mermaid")?.textContent).toContain("Markdown --> Preview");
  });

  it("does not alter MathJax or SVG nodes that exist in the preview DOM", () => {
    const {preview, exportHtml} = renderThemePreview(TECH_DEPTH_THEME.id, TECH_DEPTH_TECHNICAL_ARTICLE);
    const math = document.createElement("mjx-container");
    math.setAttribute("jax", "SVG");
    math.innerHTML = '<svg viewBox="0 0 1 1"><path d="M0 0"></path></svg>';
    preview.appendChild(math);

    const exported = toRoot(exportHtml());

    expect(math.querySelector("svg path")?.getAttribute("d")).toBe("M0 0");
    expect(exported.querySelector("mjx-container")).toBeNull();
    expect(exported.querySelector("section svg path")?.getAttribute("d")).toBe("M0 0");
    expect(exported.querySelector("pre.custom > code.hljs")?.getAttribute("style")).toContain("background: #f8f8f8");
  });

  it("runs the graphite theme through the standard parser, preview, and WeChat export", () => {
    const {rawHtml, preview, exportHtml} = renderThemePreview(GRAPHITE_MINIMAL_THEME.id, TECH_DEPTH_TECHNICAL_ARTICLE);
    const parsed = toRoot(rawHtml);

    expect(rawHtml).toContain('<pre class="custom"><code class="hljs">');
    expect(preview.querySelectorAll(".plainly-graphite-minimal-title")).toHaveLength(1);
    expect(preview.querySelector(".plainly-graphite-minimal-section-number")?.textContent).toBe("01");
    expect(preview.querySelector(".plainly-graphite-minimal-section-title strong")?.textContent).toBe("渲染");
    expect(preview.querySelector(".plainly-graphite-minimal-section-title em")?.textContent).toBe("边界");
    expect(preview.querySelector(".plainly-graphite-minimal-section-title a")?.getAttribute("href")).toBe(
      "https://example.com/render-contract",
    );
    expect(preview.querySelector(".plainly-graphite-minimal-list ul ul li strong")?.textContent).toBe("强调");
    expect(preview.querySelectorAll(".plainly-graphite-minimal-list .plainly-graphite-minimal-list")).toHaveLength(0);
    expect(preview.querySelector("pre.custom")?.outerHTML).toBe(parsed.querySelector("pre.custom")?.outerHTML);
    expect(preview.querySelector(".mermaid")?.outerHTML).toBe(parsed.querySelector(".mermaid")?.outerHTML);

    const exportedHtml = exportHtml();
    const exported = toRoot(exportedHtml);

    expect(exported.querySelector(".plainly-graphite-minimal-section-number")?.getAttribute("style")).toContain("color");
    expect(exported.querySelector(".plainly-graphite-minimal-list ul ul")).not.toBeNull();
    expect(exported.querySelector("pre.custom > code.hljs")).not.toBeNull();
    expect(exported.querySelector("pre.custom > code.hljs")?.getAttribute("style")).toContain("background: #f8f8f8");
    expect(exported.querySelector(".mermaid")?.textContent).toContain("Markdown --> Preview");
    expect(exportedHtml).not.toMatch(/var\(|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
  });

  it("keeps WeChat parser fenced-code structure for the graphite theme through export", () => {
    const {rawHtml, preview, exportHtml} = renderThemePreview(
      GRAPHITE_MINIMAL_THEME.id,
      TECH_DEPTH_TECHNICAL_ARTICLE,
      "wechat",
    );
    const parsed = toRoot(rawHtml);

    expect(rawHtml).toContain('class="code-snippet__fix code-snippet__js"');
    expect(preview.querySelectorAll(".plainly-graphite-minimal-title")).toHaveLength(1);
    expect(preview.querySelector(".plainly-graphite-minimal-section-number")?.textContent).toBe("01");
    expect(preview.querySelector(".plainly-graphite-minimal-list ul ul")).not.toBeNull();
    expect(preview.querySelector(".code-snippet__fix")?.outerHTML).toBe(parsed.querySelector(".code-snippet__fix")?.outerHTML);
    expect(preview.querySelector(".code-snippet__fix")?.closest(".plainly-graphite-minimal-list")).toBeNull();
    expect(preview.querySelector(".mermaid")?.outerHTML).toBe(parsed.querySelector(".mermaid")?.outerHTML);

    const exportedHtml = exportHtml();
    const exported = toRoot(exportedHtml);

    expect(exported.querySelector(".plainly-graphite-minimal-section-number")?.getAttribute("style")).toContain("color");
    expect(exported.querySelector(".plainly-graphite-minimal-list ul ul")).not.toBeNull();
    expect(exported.querySelector(".code-snippet__fix")).not.toBeNull();
    expect(exported.querySelector(".code-snippet__fix")?.closest(".plainly-graphite-minimal-list")).toBeNull();
    expect(exported.querySelector(".mermaid")?.textContent).toContain("Markdown --> Preview");
    expect(exportedHtml).not.toMatch(/var\(|display\s*:\s*grid|position\s*:\s*(absolute|fixed|sticky)|float\s*:/i);
  });
});
