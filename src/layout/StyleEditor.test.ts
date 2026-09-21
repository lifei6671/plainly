jest.mock("../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

import {getCustomStyleFromThemeIndex} from "./StyleEditor";
import {getThemeList, themeRegistry} from "../theme";

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
});
