const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);

export const SCROLL_SOURCE_LINE_ATTR = "data-scroll-source-line";

type MarkdownToken = {
  type: string;
  tag?: string;
  markup?: string;
  map?: [number, number] | null;
};

type MarkdownParser = {
  parse: (markdown: string, env: object) => MarkdownToken[];
  render: (markdown: string) => string;
};

type MarkdownEditor = {
  getScrollInfo: () => {height: number; clientHeight: number};
  heightAtLine?: (line: number, mode?: string) => number;
  charCoords?: (position: {line: number; ch: number}, mode?: string) => {top: number};
  lineCount?: () => number;
};

export type ScrollAnchor = {
  editorTop: number;
  previewTop: number;
};

export const getScrollableRange = (scrollHeight: number, clientHeight: number) =>
  Math.max(0, finiteOrZero(scrollHeight) - finiteOrZero(clientHeight));

export const mapScrollByRatio = (
  sourceTop: number,
  sourceScrollHeight: number,
  sourceClientHeight: number,
  targetScrollHeight: number,
  targetClientHeight: number,
) => {
  const sourceRange = getScrollableRange(sourceScrollHeight, sourceClientHeight);
  const targetRange = getScrollableRange(targetScrollHeight, targetClientHeight);
  if (sourceRange <= 0 || targetRange <= 0) return 0;

  const ratio = Math.max(0, Math.min(1, finiteOrZero(sourceTop) / sourceRange));
  return ratio * targetRange;
};

const getHeadingLevel = (token: MarkdownToken) => {
  const tagMatch = /^h([1-3])$/.exec(token.tag || "");
  if (tagMatch) return Number(tagMatch[1]);

  const markupMatch = /^(#{1,3})$/.exec(token.markup || "");
  return markupMatch ? markupMatch[1].length : null;
};

/** Adds source-line attributes only to preview headings; exported HTML strips them later. */
export const renderMarkdownWithHeadingAnchors = (markdown: string, parser: MarkdownParser) => {
  const html = parser.render(markdown);
  if (typeof document === "undefined") return html;

  const sourceHeadings = parser
    .parse(markdown, {})
    .filter((token) => token.type === "heading_open" && token.map && token.map[0] >= 0 && getHeadingLevel(token))
    .map((token) => ({line: (token.map as [number, number])[0], level: getHeadingLevel(token) as number}));
  if (!sourceHeadings.length) return html;

  const root = document.createElement("div");
  root.innerHTML = html;
  const headings = Array.from(root.querySelectorAll("h1,h2,h3"));
  let sourceIndex = 0;
  let headingIndex = 0;

  while (sourceIndex < sourceHeadings.length && headingIndex < headings.length) {
    const source = sourceHeadings[sourceIndex];
    const heading = headings[headingIndex];
    const headingLevel = Number(heading.tagName.slice(1));
    if (source.level === headingLevel) {
      heading.setAttribute(SCROLL_SOURCE_LINE_ATTR, String(source.line));
      sourceIndex += 1;
      headingIndex += 1;
    } else if (sourceHeadings.slice(sourceIndex + 1).some((candidate) => candidate.level === headingLevel)) {
      sourceIndex += 1;
    } else {
      headingIndex += 1;
    }
  }

  return root.innerHTML;
};

export const stripHeadingAnchorAttributes = (html: string) =>
  html.replace(new RegExp(`\\s${SCROLL_SOURCE_LINE_ATTR}\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+)`, "gi"), "");

const clamp = (value: number, max: number) => Math.max(0, Math.min(max, value));

const getEditorTopForLine = (editor: MarkdownEditor, line: number, max: number) => {
  if (!Number.isInteger(line) || line < 0 || (editor.lineCount && line >= editor.lineCount())) return null;

  try {
    const top = typeof editor.heightAtLine === "function"
      ? editor.heightAtLine(line, "local")
      : editor.charCoords?.({line, ch: 0}, "local")?.top;
    return typeof top === "number" && Number.isFinite(top) ? clamp(top, max) : null;
  } catch (_error) {
    return null;
  }
};

const getElementTopInScrollContainer = (element: Element, container: HTMLElement) => {
  const top = element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
  return Number.isFinite(top) ? top : null;
};

/** Builds sparse H1/H2/H3 anchors from the current preview layout; it never caches geometry. */
export const buildLiveHeadingAnchors = ({
  markdownEditor,
  previewContainer,
  previewRoot,
}: {
  markdownEditor: MarkdownEditor;
  previewContainer: HTMLElement;
  previewRoot: HTMLElement;
}): ScrollAnchor[] | null => {
  const editorInfo = markdownEditor.getScrollInfo();
  const editorMax = getScrollableRange(editorInfo.height, editorInfo.clientHeight);
  const previewMax = getScrollableRange(previewContainer.scrollHeight, previewContainer.clientHeight);
  if (editorMax <= 0 || previewMax <= 0) return null;

  const candidates = Array.from(previewRoot.querySelectorAll(`[${SCROLL_SOURCE_LINE_ATTR}]`))
    .map((element) => {
      const line = Number(element.getAttribute(SCROLL_SOURCE_LINE_ATTR));
      const editorTop = getEditorTopForLine(markdownEditor, line, editorMax);
      const previewTop = getElementTopInScrollContainer(element, previewContainer);
      return editorTop === null || previewTop === null ? null : {
        editorTop,
        previewTop: clamp(previewTop, previewMax),
      };
    })
    .filter((anchor): anchor is ScrollAnchor => Boolean(anchor))
    .sort((left, right) => left.editorTop - right.editorTop || left.previewTop - right.previewTop);

  const anchors: ScrollAnchor[] = [{editorTop: 0, previewTop: 0}];
  candidates.forEach((candidate) => {
    const previous = anchors[anchors.length - 1];
    if (candidate.editorTop <= previous.editorTop || candidate.previewTop <= previous.previewTop) return;
    anchors.push(candidate);
  });

  const last = anchors[anchors.length - 1];
  if (editorMax > last.editorTop && previewMax > last.previewTop) {
    anchors.push({editorTop: editorMax, previewTop: previewMax});
  }

  return anchors.length >= 3 ? anchors : null;
};

const mapScrollByAnchors = (
  anchors: ScrollAnchor[],
  source: number,
  sourceKey: keyof ScrollAnchor,
  targetKey: keyof ScrollAnchor,
) => {
  const value = finiteOrZero(source);
  if (value <= anchors[0][sourceKey]) return anchors[0][targetKey];
  const last = anchors[anchors.length - 1];
  if (value >= last[sourceKey]) return last[targetKey];

  for (let index = 1; index < anchors.length; index += 1) {
    const next = anchors[index];
    if (value <= next[sourceKey]) {
      const previous = anchors[index - 1];
      const range = next[sourceKey] - previous[sourceKey];
      if (range <= 0) return next[targetKey];
      const ratio = (value - previous[sourceKey]) / range;
      return previous[targetKey] + (next[targetKey] - previous[targetKey]) * ratio;
    }
  }

  return last[targetKey];
};

export const mapEditorToPreviewByAnchors = (anchors: ScrollAnchor[] | null, editorTop: number) =>
  anchors ? mapScrollByAnchors(anchors, editorTop, "editorTop", "previewTop") : null;

export const mapPreviewToEditorByAnchors = (anchors: ScrollAnchor[] | null, previewTop: number) =>
  anchors ? mapScrollByAnchors(anchors, previewTop, "previewTop", "editorTop") : null;
