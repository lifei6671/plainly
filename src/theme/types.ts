export type ThemeMode = "legacy-css" | "element-map" | "component";

export type ElementStyleMap = Readonly<Record<string, string>>;

export type ThemeTransform = (html: string) => string;

type ThemeMetadata = Readonly<{
  id: string;
  name: string;
  category: string;
  author: string;
  isNew?: boolean;
  source: string;
  license: string;
  transform?: ThemeTransform;
  wechatStyleModule?: string;
}>;

export type LegacyCssThemeDefinition = ThemeMetadata & Readonly<{mode: "legacy-css"; css: string}>;
export type ElementMapThemeDefinition = ThemeMetadata & Readonly<{mode: "element-map"; styles: ElementStyleMap}>;
export type ComponentThemeDefinition = ThemeMetadata & Readonly<{mode: "component"}>;

export type ThemeDefinition = LegacyCssThemeDefinition | ElementMapThemeDefinition | ComponentThemeDefinition;
