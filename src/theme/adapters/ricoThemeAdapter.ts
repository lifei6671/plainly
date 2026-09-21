import type {ElementStyleMap} from "../types";

const INLINE_CODE_SELECTORS = ["p code", "li > section code", "blockquote code", "td code", "th code"];

const splitSelectorList = (selectorList: string) => {
  const selectors: string[] = [];
  let current = "";
  let depth = 0;
  let quote = "";

  for (const character of selectorList) {
    if (quote) {
      current += character;
      if (character === quote) quote = "";
    } else if (character === "\"" || character === "'") {
      quote = character;
      current += character;
    } else if (character === "(" || character === "[") {
      depth += 1;
      current += character;
    } else if (character === ")" || character === "]") {
      depth -= 1;
      current += character;
    } else if (character === "," && depth === 0) {
      selectors.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  if (current.trim()) selectors.push(current.trim());
  return selectors;
};

const scopedSelectors = (selector: string) => {
  if (selector === "container") return ["#nice"];
  if (selector === "code") return INLINE_CODE_SELECTORS.map((item) => `#nice ${item}`);
  if (selector === "li") return ["#nice li", "#nice li > section"];
  if (selector === "li p") return ["#nice li p", "#nice li > section p", "#nice li > section"];
  return splitSelectorList(selector).map((item) => (item.startsWith("#nice") ? item : `#nice ${item}`));
};

/** Converts Rico's element map to CSS isolated below Plainly's preview root. */
export const ricoElementMapToCss = (styles: ElementStyleMap) =>
  Object.entries(styles)
    .filter(([, declarations]) => declarations.trim())
    .map(([selector, declarations]) => `${scopedSelectors(selector).join(", ")} { ${declarations.trim()} }`)
    .join("\n");
