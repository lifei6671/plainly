import {ricoElementMapToCss} from "../../adapters/ricoThemeAdapter";
import type {ElementStyleMap, ComponentThemeDefinition, ThemeTransform} from "../../types";
import {withPlainlyCompatibility} from "../../rico/themes";
import {moyuGreenTheme} from "./gzh-upstream/moyu-green";
import {redWhiteTheme} from "./gzh-upstream/red-white";
import {moyuTicketTheme} from "./gzh-upstream/moyu-ticket";
import {oliveJournalTheme} from "./gzh-upstream/olive-journal";
import {monoBlueEditorialTheme} from "./gzh-upstream/mono-blue-editorial";

type GzhSourceTheme = Readonly<{
  name: string;
  styles: ElementStyleMap;
  transform: (document: Document, context: {fontScale: number; displaySettings: Record<string, unknown>}) => void;
}>;

const gzhTransform = (theme: GzhSourceTheme): ThemeTransform => (html) => {
  const sourceDocument = document.implementation.createHTMLDocument("plainly-gzh-theme");
  sourceDocument.body.innerHTML = html;
  theme.transform(sourceDocument, {fontScale: 1, displaySettings: {}});
  return sourceDocument.body.innerHTML;
};

const gzhTheme = (id: string, sourceId: string, theme: GzhSourceTheme): ComponentThemeDefinition => ({
  id: `plainly-${id}`,
  name: theme.name,
  category: "Rico MD gzh-design-skill",
  author: "Jiamu × Moyu Xiaoli",
  source: `ricocc/rico-md@8c22fe5711365ffe646a0987b6d670d22511de58: assets/styles/themes/gzh/${sourceId}.js`,
  license: "AGPL-3.0-or-later",
  isNew: true,
  mode: "component",
  transform: gzhTransform(theme),
  css: ricoElementMapToCss(withPlainlyCompatibility(theme.styles)),
});

/** Rico MD's remaining gzh-design-skill themes in their fixed pack order. */
export const GZH_REMAINING_SOURCE_THEMES: readonly GzhSourceTheme[] = [
  moyuGreenTheme,
  redWhiteTheme,
  moyuTicketTheme,
  oliveJournalTheme,
  monoBlueEditorialTheme,
];

export const GZH_REMAINING_COMPONENT_THEMES: readonly ComponentThemeDefinition[] = [
  gzhTheme("gzh-moyu-green", "moyu-green", GZH_REMAINING_SOURCE_THEMES[0]),
  gzhTheme("gzh-red-white", "red-white", GZH_REMAINING_SOURCE_THEMES[1]),
  gzhTheme("gzh-moyu-ticket", "moyu-ticket", GZH_REMAINING_SOURCE_THEMES[2]),
  gzhTheme("gzh-olive-journal", "olive-journal", GZH_REMAINING_SOURCE_THEMES[3]),
  gzhTheme("gzh-mono-blue-editorial", "mono-blue-editorial", GZH_REMAINING_SOURCE_THEMES[4]),
];
