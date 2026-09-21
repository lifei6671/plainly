import TEMPLATE from "../template";
import {TEMPLATE_OPTIONS} from "../utils/constant";
import {ThemeRegistry} from "./registry";
import {RICO_THEMES} from "./rico/themes";
import {resolveThemeHtmlForTemplate as resolveThemeHtmlForTemplateInRegistry} from "./templateResolver";
import type {LegacyCssThemeDefinition, ThemeDefinition} from "./types";

const legacyThemes: readonly LegacyCssThemeDefinition[] = TEMPLATE_OPTIONS.map((option) => ({
  id: option.id,
  name: option.name,
  category: "Plainly Legacy",
  author: option.author || "Plainly",
  isNew: option.isNew,
  source: "lifei6671/plainly",
  license: "GPL-3.0",
  mode: "legacy-css",
  css: TEMPLATE.style[option.id],
}));

export const themeRegistry = new ThemeRegistry([...legacyThemes, ...RICO_THEMES]);
export const getThemeList = (): readonly ThemeDefinition[] => themeRegistry.getThemes();
export const resolveThemeHtmlForTemplate = (templateNum: number, html: string) =>
  resolveThemeHtmlForTemplateInRegistry(themeRegistry, templateNum, html);
export {ThemeRegistry} from "./registry";
export type {ThemeDefinition, ThemeMode} from "./types";
