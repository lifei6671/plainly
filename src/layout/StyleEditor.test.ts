jest.mock("../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

import {getCustomStyleFromTheme, getCustomStyleFromThemeIndex, getStyleEditorChangeAction} from "./StyleEditor";
import {getThemeList, themeRegistry} from "../theme";
import type {ThemeDefinition} from "../theme/types";

describe("getCustomStyleFromThemeIndex", () => {
  it.each(["normal", "rico-minimalism"])("copies the Registry-resolved CSS for %s", (id) => {
    const index = getThemeList().findIndex((theme) => theme.id === id);
    const css = themeRegistry.resolveThemeCss(id);

    expect(getCustomStyleFromThemeIndex(index)).toBe(`/*自定义样式，实时生效*/\n\n${css}`);
  });

  it("does not treat the custom theme as a source theme", () => {
    const index = getThemeList().findIndex((theme) => theme.id === "custom");

    expect(getCustomStyleFromThemeIndex(index)).toBeUndefined();
  });

  it("does not copy a component theme into custom CSS", () => {
    const component: ThemeDefinition = {
      id: "component",
      name: "Component",
      category: "test",
      author: "Plainly",
      source: "test",
      license: "MIT",
      mode: "component",
      transform: (html) => html,
    };

    expect(getCustomStyleFromTheme(component)).toBeUndefined();
  });

  it("does not open the copy flow or save custom CSS when a component theme editor is focused", () => {
    const component: ThemeDefinition = {
      id: "component",
      name: "Component",
      category: "test",
      author: "Plainly",
      source: "test",
      license: "MIT",
      mode: "component",
      transform: (html) => html,
    };

    expect(getStyleEditorChangeAction(component, true)).toBeUndefined();
  });
});
