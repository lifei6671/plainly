import type {ThemeTransform} from "../types";
import type {ComponentBlockTag, ComponentRendererMap} from "./types";
import {SCROLL_SOURCE_LINE_ATTR} from "../../utils/syncScroll";

const componentBlockTags = new Set<ComponentBlockTag>([
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "blockquote",
  "ul",
  "ol",
  "hr",
  "figure",
  "table",
]);

const getComponentBlockTag = (element: Element): ComponentBlockTag | undefined => {
  const tag = element.tagName.toLowerCase();
  return componentBlockTags.has(tag as ComponentBlockTag) ? (tag as ComponentBlockTag) : undefined;
};

export const createComponentThemeTransform = (renderers: ComponentRendererMap): ThemeTransform => (html) => {
  const root = document.createElement("div");
  root.innerHTML = html;

  const tagIndexes = new Map<string, number>();
  let heading2Index = 0;

  Array.from(root.children).forEach((sourceElement, blockOffset) => {
    const tag = sourceElement.tagName.toLowerCase();
    const tagIndex = (tagIndexes.get(tag) ?? 0) + 1;
    tagIndexes.set(tag, tagIndex);

    if (tag === "h2") {
      heading2Index += 1;
    }

    const componentTag = getComponentBlockTag(sourceElement);
    const renderer = componentTag ? renderers[componentTag] : undefined;
    if (!renderer) {
      return;
    }

    const replacement = renderer(sourceElement, {
      document,
      blockIndex: blockOffset + 1,
      tagIndex,
      heading2Index,
    });
    if (replacement) {
      const sourceMarker = sourceElement.getAttribute(SCROLL_SOURCE_LINE_ATTR);
      const replacementHasMarker =
        replacement.nodeType === 1
          ? (replacement as Element).hasAttribute(SCROLL_SOURCE_LINE_ATTR) || Boolean((replacement as Element).querySelector(`[${SCROLL_SOURCE_LINE_ATTR}]`))
          : Boolean((replacement as DocumentFragment).querySelector?.(`[${SCROLL_SOURCE_LINE_ATTR}]`));
      const markerTarget = replacement.nodeType === 1
        ? replacement as Element
        : (replacement as DocumentFragment).firstElementChild;
      if (sourceMarker !== null && !replacementHasMarker && markerTarget) {
        markerTarget.setAttribute(SCROLL_SOURCE_LINE_ATTR, sourceMarker);
      }
      sourceElement.replaceWith(replacement);
    }
  });

  return root.innerHTML;
};
