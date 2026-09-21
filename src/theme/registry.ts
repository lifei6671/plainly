import {ricoElementMapToCss} from "./adapters/ricoThemeAdapter";
import type {ThemeDefinition} from "./types";

export class ThemeRegistry {
  private readonly themes = new Map<string, ThemeDefinition>();

  constructor(themes: readonly ThemeDefinition[] = []) {
    themes.forEach((theme) => this.register(theme));
  }

  register(theme: ThemeDefinition) {
    if (this.themes.has(theme.id)) throw new Error(`Theme already registered: ${theme.id}`);
    this.themes.set(theme.id, theme);
    return this;
  }

  getThemes() {
    return Array.from(this.themes.values());
  }

  getTheme(id: string) {
    return this.themes.get(id);
  }

  resolveThemeCss(id: string) {
    const theme = this.getTheme(id);
    if (!theme) return undefined;
    if (theme.mode === "legacy-css") return theme.css;
    if (theme.mode === "element-map") return ricoElementMapToCss(theme.styles);
    return undefined;
  }
}
