import type {ComponentThemeDefinition} from "../../types";
import {GRAPHITE_MINIMAL_THEME} from "./graphiteMinimal";
import {GZH_REMAINING_COMPONENT_THEMES} from "./gzhRemaining";
import {TECH_DEPTH_THEME} from "./techDepth";
import {ZEN_WHITESPACE_THEME} from "./zenWhitespace";

export const PLAINLY_COMPONENT_THEMES: readonly ComponentThemeDefinition[] = [
  TECH_DEPTH_THEME,
  GRAPHITE_MINIMAL_THEME,
  ZEN_WHITESPACE_THEME,
  ...GZH_REMAINING_COMPONENT_THEMES,
];
export {GRAPHITE_MINIMAL_THEME} from "./graphiteMinimal";
export {GZH_REMAINING_COMPONENT_THEMES} from "./gzhRemaining";
export {TECH_DEPTH_THEME} from "./techDepth";
export {ZEN_WHITESPACE_THEME} from "./zenWhitespace";
