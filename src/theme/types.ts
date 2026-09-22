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
  wechatStyleModule?: string;
}>;

type OptionalTransformThemeMetadata = ThemeMetadata & Readonly<{transform?: ThemeTransform}>;

export type LegacyCssThemeDefinition = OptionalTransformThemeMetadata & Readonly<{mode: "legacy-css"; css: string}>;
export type ElementMapThemeDefinition = OptionalTransformThemeMetadata & Readonly<{mode: "element-map"; styles: ElementStyleMap}>;
export type ComponentThemeDefinition = ThemeMetadata & Readonly<{mode: "component"; transform: ThemeTransform; css?: string}>;

export type ThemeDefinition = LegacyCssThemeDefinition | ElementMapThemeDefinition | ComponentThemeDefinition;
