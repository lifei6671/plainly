jest.mock("../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

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
