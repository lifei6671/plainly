import type {ThemeRegistry} from "./registry";

export const resolveThemeHtmlForTemplate = (registry: ThemeRegistry, templateNum: number, html: string) => {
  const theme = registry.getThemes()[templateNum];
  return theme ? registry.resolveThemeHtml(theme.id, html) : html;
};
