declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;

jest.mock("../../template", () => ({
  __esModule: true,
  default: {style: new Proxy({}, {get: () => "/* legacy CSS */"})},
}));

import {getThemeList} from "../../theme";
import type {ThemeDefinition} from "../../theme";
import {groupThemesForMenu} from "./themeMenu";

const leafThemes = (themes: readonly ThemeDefinition[]) => {
  const {groups, custom} = groupThemesForMenu(themes);
  return [...groups.flatMap((group) => group.themes), ...(custom ? [custom] : [])];
};

const elementTheme = (id: string): ThemeDefinition => ({
  id,
  name: id,
  category: "Unclassified",
  author: "Test",
  source: "test",
  license: "MIT",
  mode: "element-map",
  styles: {},
});

describe("groupThemesForMenu", () => {
  const themes = getThemeList();
  const menu = groupThemesForMenu(themes);
  const group = (key) => menu.groups.find((item) => item.key === key)!;

  it("lists every registry theme once with its global registry index", () => {
    const leaves = leafThemes(themes);
    expect(leaves).toHaveLength(themes.length);
    expect(leaves.map((item) => item.index).sort((a, b) => a - b)).toEqual(themes.map((_theme, index) => index));
    expect(new Set(leaves.map((item) => item.theme.id)).size).toBe(themes.length);
  });

  it("keeps custom separate and splits the current legacy themes into two registry-ordered groups", () => {
    expect(menu.custom).toMatchObject({theme: {id: "custom"}});
    expect(group("legacy-classic").themes).toHaveLength(10);
    expect(group("legacy-extended").themes).toHaveLength(10);
    expect([...group("legacy-classic").themes, ...group("legacy-extended").themes].map((item) => item.theme.id)).toEqual(
      themes.filter((theme) => theme.category === "Plainly Legacy" && theme.id !== "custom").map((theme) => theme.id),
    );
  });

  it("classifies Rico and Plainly component themes from their metadata while preserving registry order", () => {
    expect(menu.groups.map((item) => item.key)).toEqual([
      "legacy-classic",
      "legacy-extended",
      "rico-wechat",
      "rico-editorial",
      "rico-components",
      "plainly-original",
    ]);
    expect(group("rico-wechat").themes).toHaveLength(11);
    expect(group("rico-editorial").themes).toHaveLength(10);
    expect(group("rico-components").themes).toHaveLength(7);
    expect(group("rico-wechat").themes.every((item) => item.theme.id.startsWith("rico-wechat-"))).toBe(true);
    expect(
      group("rico-editorial").themes.every(
        (item) => item.theme.id.startsWith("rico-") && !item.theme.id.startsWith("rico-wechat-"),
      ),
    ).toBe(true);
    expect(
      group("rico-components").themes.every(
        (item) =>
          item.theme.mode === "component" &&
          item.theme.license === "AGPL-3.0-or-later" &&
          item.theme.source.includes("ricocc/rico-md") &&
          item.theme.source.includes("assets/styles/themes/gzh/"),
      ),
    ).toBe(true);
    expect(group("rico-components").themes.map((item) => item.theme.id)).toEqual([
      "plainly-graphite-minimal",
      "plainly-zen-whitespace",
      "plainly-gzh-moyu-green",
      "plainly-gzh-red-white",
      "plainly-gzh-moyu-ticket",
      "plainly-gzh-olive-journal",
      "plainly-gzh-mono-blue-editorial",
    ]);
    expect(group("plainly-original").themes.map((item) => item.theme.id)).toEqual(["plainly-tech-depth"]);

    menu.groups.forEach((item) => {
      const indexes = item.themes.map((theme) => theme.index);
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    });
  });

  it("keeps an unrecognized future theme in the fallback group", () => {
    const fallback = groupThemesForMenu([...themes, elementTheme("future-theme")]).groups.find((item) => item.key === "other");
    expect(fallback?.themes).toEqual([expect.objectContaining({index: themes.length, theme: expect.objectContaining({id: "future-theme"})})]);
  });
});
