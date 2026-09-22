import type {ElementStyleMap} from "../types";

const INLINE_CODE_SELECTORS = ["p code", "li code", "li > section code", "blockquote code", "td code", "th code"];
const PARAGRAPH_SELECTORS = ["p", "li p", "li > section p", "blockquote p", "td p", "th p"];

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
  if (selector === "strong") return ["#nice strong", "#nice em strong"];
  if (selector === "p") return PARAGRAPH_SELECTORS.map((item) => `#nice ${item}`);
  if (selector === "tr") return ["#nice tr", "#nice table tr", "#nice table tr:nth-child(2n)"];
  if (selector === "th") return ["#nice th", "#nice table tr th"];
  if (selector === "td") return ["#nice td", "#nice table tr td"];
  if (selector === "li") return ["#nice li", "#nice li > section"];
  if (selector === "li p") return ["#nice li p", "#nice li > section p", "#nice li > section"];
  return splitSelectorList(selector).map((item) => (item.startsWith("#nice") ? item : `#nice ${item}`));
};

/** Converts Rico's element map to CSS isolated below Plainly's preview root. */
export const ricoElementMapToCss = (styles: ElementStyleMap) =>
  Object.entries(styles)
    .filter(([selector, declarations]) => selector !== "pre" && declarations.trim())
    .map(([selector, declarations]) => `${scopedSelectors(selector).join(", ")} { ${declarations.trim()} }`)
    .join("\n");
