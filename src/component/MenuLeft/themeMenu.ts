import type {ThemeDefinition} from "../../theme";

export type ThemeMenuGroupKey =
  | "legacy-classic"
  | "legacy-extended"
  | "rico-wechat"
  | "rico-editorial"
  | "rico-components"
  | "plainly-original"
  | "other";

export type IndexedTheme = Readonly<{
  index: number;
  theme: ThemeDefinition;
}>;

export type ThemeMenuGroup = Readonly<{
  key: ThemeMenuGroupKey;
  label: string;
  themes: readonly IndexedTheme[];
}>;

export type ThemeMenuGroups = Readonly<{
  groups: readonly ThemeMenuGroup[];
  custom?: IndexedTheme;
}>;

const LEGACY_CATEGORY = "Plainly Legacy";
const PLAINLY_SOURCE = "lifei6671/plainly";

const isRicoGzhComponent = (theme: ThemeDefinition) =>
  theme.mode === "component" &&
  theme.license === "AGPL-3.0-or-later" &&
  theme.source.includes("ricocc/rico-md") &&
  theme.source.includes("assets/styles/themes/gzh/");

const isPlainlyOriginalComponent = (theme: ThemeDefinition) =>
  theme.mode === "component" && theme.source === PLAINLY_SOURCE;

/**
 * Groups registry-ordered themes for the cascading Theme menu without changing
 * the global indexes consumed by `changeTemplate`.
 */
export const groupThemesForMenu = (themes: readonly ThemeDefinition[]): ThemeMenuGroups => {
  const legacy: IndexedTheme[] = [];
  const groups: Record<Exclude<ThemeMenuGroupKey, "legacy-classic" | "legacy-extended">, IndexedTheme[]> = {
    "rico-wechat": [],
    "rico-editorial": [],
    "rico-components": [],
    "plainly-original": [],
    other: [],
  };
  let custom: IndexedTheme | undefined;

  themes.forEach((theme, index) => {
    const indexedTheme = {theme, index};
    if (theme.category === LEGACY_CATEGORY) {
      if (theme.id === "custom") {
        custom = indexedTheme;
      } else {
        legacy.push(indexedTheme);
      }
    } else if (theme.id.startsWith("rico-wechat-")) {
      groups["rico-wechat"].push(indexedTheme);
    } else if (isRicoGzhComponent(theme)) {
      groups["rico-components"].push(indexedTheme);
    } else if (theme.id.startsWith("rico-")) {
      groups["rico-editorial"].push(indexedTheme);
    } else if (isPlainlyOriginalComponent(theme)) {
      groups["plainly-original"].push(indexedTheme);
    } else {
      groups.other.push(indexedTheme);
    }
  });

  const menuGroups: ThemeMenuGroup[] = [
    {key: "legacy-classic", label: "内置 · 经典", themes: legacy.slice(0, 10)},
    {key: "legacy-extended", label: "内置 · 扩展", themes: legacy.slice(10)},
    {key: "rico-wechat", label: "Rico · 公众号", themes: groups["rico-wechat"]},
    {key: "rico-editorial", label: "Rico · 编辑", themes: groups["rico-editorial"]},
    {key: "rico-components", label: "Rico · 组件", themes: groups["rico-components"]},
    {key: "plainly-original", label: "Plainly 原创", themes: groups["plainly-original"]},
    {key: "other", label: "其他主题", themes: groups.other},
  ];

  return {groups: menuGroups.filter((group) => group.themes.length > 0), custom};
};
