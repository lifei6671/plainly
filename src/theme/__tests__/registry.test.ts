jest.mock("../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

import {ThemeRegistry} from "../registry";
import {themeRegistry} from "..";
import type {ThemeDefinition} from "../types";

const metadata = {name: "Test", category: "test", author: "Plainly", source: "test", license: "MIT"};

describe("ThemeRegistry", () => {
  it("resolves legacy Plainly CSS without changing it", () => {
    const theme: ThemeDefinition = {id: "legacy", ...metadata, mode: "legacy-css", css: "#nice p { color: black; }"};
    expect(new ThemeRegistry([theme]).resolveThemeCss("legacy")).toBe(theme.css);
  });

  it("resolves Rico element-map CSS through the adapter", () => {
    const theme: ThemeDefinition = {id: "rico", ...metadata, mode: "element-map", styles: {h1: "color: red;"}};
    expect(new ThemeRegistry([theme]).resolveThemeCss("rico")).toContain("#nice h1 { color: red; }");
  });

  it("uses an empty component CSS value to clear the previous Markdown CSS", () => {
    const legacy: ThemeDefinition = {id: "legacy", ...metadata, mode: "legacy-css", css: "#nice { color: black; }"};
    const component: ThemeDefinition = {id: "component", ...metadata, mode: "component", transform: (html) => html};
    const registry = new ThemeRegistry([legacy, component]);

    let markdownCss = registry.resolveThemeCss("legacy");
    markdownCss = registry.resolveThemeCss("component");

    expect(markdownCss).toBe("");
  });

  it("returns component base CSS and still applies its DOM transform", () => {
    const transform = jest.fn((html: string) => `<article>${html}</article>`);
    const component: ThemeDefinition = {id: "component", ...metadata, mode: "component", css: ".component {}", transform};
    const registry = new ThemeRegistry([component]);

    expect(registry.resolveThemeCss("component")).toBe(component.css);
    expect(registry.resolveThemeHtml("component", "<p>content</p>")).toBe("<article><p>content</p></article>");
    expect(transform).toHaveBeenCalledWith("<p>content</p>");
  });

  it("returns undefined for unknown ids", () => {
    expect(themeRegistry.getTheme("missing")).toBeUndefined();
    expect(themeRegistry.resolveThemeCss("missing")).toBeUndefined();
  });

  it("exposes complete metadata", () => {
    const theme = themeRegistry.getTheme("rico-minimalism");
    expect(theme).toMatchObject({name: "简约沉浸", category: "简约主义", author: "Rico MD", source: "ricocc/rico-md", license: "MIT", mode: "element-map"});
  });

  it.each(["nightPurple", "extremeBlack"])("preserves the legacy new badge for %s", (id) => {
    expect(themeRegistry.getTheme(id)).toMatchObject({isNew: true});
  });

  it.each(["rico-minimalism", "rico-wechat-anthropic", "rico-wechat-apple", "rico-latepost-depth", "rico-kami-paper"])("registers %s", (id) => {
    expect(themeRegistry.getTheme(id)).toBeDefined();
  });
});
