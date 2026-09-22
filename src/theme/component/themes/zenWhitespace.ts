import {createComponentThemeTransform, moveChildren} from "..";
import type {ComponentThemeDefinition} from "../../types";

/**
 * Rico MD gzh-design-skill adaptation mapping, not an original Plainly design.
 * Source: ricocc/rico-md@8c22fe5711365ffe646a0987b6d670d22511de58,
 * assets/styles/themes/gzh/zen-whitespace.js.
 * Copyright (C) 2026 Jiamu × Moyu Xiaoli. SPDX-License-Identifier: AGPL-3.0-or-later.
 * See Rico MD's docs/gzh-design-skill.md and licenses/gzh-design-skill.txt.
 */

const className = (name: string) => `plainly-zen-whitespace-${name}`;
const SANS = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const SERIF = '"Noto Serif SC","Songti SC",STSong,Georgia,"Times New Roman",serif';

const splitHeadingText = (text: string) => {
  const match = text.trim().match(/^(.+?)[｜|]\s*(.+)$/);
  return match ? {title: match[1].trim(), tag: match[2].trim()} : {title: text.trim(), tag: ""};
};

const isLastTopLevelTag = (source: Element, tagName: string) => {
  for (let sibling = source.nextElementSibling; sibling; sibling = sibling.nextElementSibling) {
    if (sibling.tagName === tagName) return false;
  }
  return true;
};

const leaf = (context: {document: Document}) => {
  const placeholder = context.document.createElement("span");
  placeholder.setAttribute("leaf", "");
  placeholder.appendChild(context.document.createElement("br"));
  return placeholder;
};

const moveListItem = (item: Element, content: Element, row: Element) => {
  while (item.firstChild) {
    const child = item.removeChild(item.firstChild);
    if (child.nodeType === Node.ELEMENT_NODE && (child.nodeName === "UL" || child.nodeName === "OL")) {
      row.appendChild(child);
    } else {
      content.appendChild(child);
    }
  }
};

export const ZEN_WHITESPACE_THEME: ComponentThemeDefinition = {
  id: "plainly-zen-whitespace",
  name: "留白禅意",
  category: "随笔阅读",
  author: "Jiamu × Moyu Xiaoli",
  source: "ricocc/rico-md: assets/styles/themes/gzh/zen-whitespace.js",
  license: "AGPL-3.0-or-later",
  isNew: true,
  mode: "component",
  transform: createComponentThemeTransform({
    h2: (source, context) => {
      const chapters = Array.from(source.parentElement?.children || [])
        .filter((child) => child.tagName === "H2")
        .map((chapter) => splitHeadingText(chapter.textContent || ""));
      const {title, tag} = splitHeadingText(source.textContent || "");
      if (tag) source.textContent = title;
      const heading = source.cloneNode(false) as HTMLElement;
      moveChildren(source, heading);

      const section = context.document.createElement("section");
      section.className = className("chapter");
      const label = context.document.createElement("p");
      label.className = className("chapter-label");
      label.textContent = isLastTopLevelTag(source, "H2")
        ? "∞ · POSTSCRIPT"
        : `${String(context.heading2Index).padStart(2, "0")} · ${tag || `CHAPTER ${["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN"][context.heading2Index - 1] || `CHAPTER ${context.heading2Index}`}`}`;
      const rule = context.document.createElement("section");
      rule.className = className("chapter-rule");
      rule.appendChild(leaf(context));
      section.append(label, heading, rule);

      if (context.heading2Index !== 1 || chapters.length < 3) {
        return section;
      }

      const toc = context.document.createElement("section");
      toc.className = className("toc");
      const tocLabel = context.document.createElement("p");
      tocLabel.className = className("toc-label");
      tocLabel.textContent = "本文脉络";
      const tocBorder = context.document.createElement("section");
      tocBorder.className = className("toc-border");
      const cells = context.document.createElement("section");
      cells.className = className("toc-cells");
      chapters.slice(0, 3).forEach(({title: chapterTitle}, index) => {
        const cell = context.document.createElement("section");
        cell.className = className("toc-cell");
        const number = context.document.createElement("p");
        number.className = className("toc-number");
        number.textContent = String(index + 1).padStart(2, "0");
        const text = context.document.createElement("p");
        text.className = className("toc-title");
        text.textContent = chapterTitle || `第 ${index + 1} 节`;
        cell.append(number, text);
        cells.appendChild(cell);
      });
      tocBorder.appendChild(cells);
      toc.append(tocLabel, tocBorder);
      const fragment = context.document.createDocumentFragment();
      fragment.append(toc, section);
      return fragment;
    },
    blockquote: (source, context) => {
      const intro = context.tagIndex === 1 && context.heading2Index === 0;
      const section = context.document.createElement("section");
      section.className = className(intro ? "intro-quote" : "quote");

      if (!intro) {
        moveChildren(source, section);
        return section;
      }

      const paragraphs = Array.from(source.children).filter((child) => child.tagName === "P");
      let signature: string | undefined;
      if (paragraphs.length > 1) {
        const last = paragraphs[paragraphs.length - 1].textContent?.trim() || "";
        if (last.startsWith("——") && last.length <= 20) {
          signature = paragraphs.pop()?.textContent?.trim();
        }
      }
      (paragraphs.length ? paragraphs : [source]).forEach((paragraph) => {
        const line = context.document.createElement("p");
        line.className = className("intro-quote-line");
        moveChildren(paragraph, line);
        section.appendChild(line);
      });
      if (signature) {
        const line = context.document.createElement("p");
        line.className = className("intro-quote-signature");
        line.textContent = signature;
        section.appendChild(line);
      }
      return section;
    },
    ul: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("list");
      Array.from(source.children)
        .filter((child) => child.tagName === "LI")
        .forEach((item) => {
          const row = context.document.createElement("section");
          row.className = className("list-row");
          const marker = context.document.createElement("p");
          marker.className = className("list-marker");
          marker.textContent = "·";
          const content = context.document.createElement("p");
          content.className = className("list-content");
          row.append(marker, content);
          moveListItem(item, content, row);
          section.appendChild(row);
        });
      return section;
    },
    ol: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("list");
      Array.from(source.children)
        .filter((child) => child.tagName === "LI")
        .forEach((item, index) => {
          const row = context.document.createElement("section");
          row.className = className("list-row");
          const marker = context.document.createElement("p");
          marker.className = className("list-marker");
          marker.textContent = String(index + 1).padStart(2, "0");
          const content = context.document.createElement("p");
          content.className = className("list-content");
          row.append(marker, content);
          moveListItem(item, content, row);
          section.appendChild(row);
        });
      return section;
    },
    hr: (source, context) => {
      const outer = context.document.createElement("section");
      outer.className = className("divider");
      if (!isLastTopLevelTag(source, "HR")) {
        const line = context.document.createElement("section");
        line.className = className("divider-line");
        line.appendChild(leaf(context));
        outer.appendChild(line);
        return outer;
      }

      const end = context.document.createElement("section");
      end.className = className("divider-end");
      const before = context.document.createElement("span");
      before.className = className("divider-end-line");
      before.appendChild(leaf(context));
      const label = context.document.createElement("span");
      label.className = className("divider-end-label");
      label.textContent = "END";
      const after = context.document.createElement("span");
      after.className = className("divider-end-line");
      after.appendChild(leaf(context));
      end.append(before, label, after);
      outer.appendChild(end);
      return outer;
    },
  }),
  css: `
#nice {
  box-sizing: border-box;
  margin: 0 auto;
  padding: 16px 0 40px;
  background-color: #ffffff;
  color: #525252;
  font-family: ${SANS};
  line-height: 1.9;
  letter-spacing: 0.3px;
  overflow-wrap: anywhere;
}
#nice h1 {
  margin: 32px 16px 48px;
  padding: 0;
  font-family: ${SERIF};
  font-size: 22px;
  font-weight: 600;
  line-height: 1.6;
  color: #2b2b2b;
  text-align: center;
  letter-spacing: 1px;
}
#nice h2 { margin: 64px 0 32px; padding: 0 16px; font-family: ${SERIF}; font-size: 22px; font-weight: 700; line-height: 1.4; color: #2b2b2b; }
#nice .plainly-zen-whitespace-chapter { margin: 64px 0 32px; padding: 0 16px; }
#nice .plainly-zen-whitespace-chapter-label { margin: 0 0 10px; padding: 0; color: #4a5d52; font-size: 10px; font-weight: 600; line-height: normal; letter-spacing: 4px; text-transform: uppercase; }
#nice .plainly-zen-whitespace-chapter h2 { margin: 0 0 16px; padding: 0; font-family: ${SERIF}; font-size: 22px; font-weight: 700; line-height: 1.4; color: #2b2b2b; letter-spacing: 0.5px; }
#nice .plainly-zen-whitespace-chapter-rule { width: 40px; height: 2px; background: #4a5d52; }
#nice .plainly-zen-whitespace-toc { padding: 0 16px 48px; }
#nice .plainly-zen-whitespace-toc-label { margin: 0 0 20px; padding: 0; color: #a3a3a3; font-size: 11px; line-height: normal; letter-spacing: 2px; text-transform: uppercase; }
#nice .plainly-zen-whitespace-toc-border { border-top: 1px solid #e8e8e8; }
#nice .plainly-zen-whitespace-toc-cells { display: flex; }
#nice .plainly-zen-whitespace-toc-cell { flex: 1; padding: 18px 12px 18px 0; border-right: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; margin-right: 16px; }
#nice .plainly-zen-whitespace-toc-cell:last-child { padding: 18px 0; border-right: 0; margin-right: 0; }
#nice .plainly-zen-whitespace-toc-number { margin: 0 0 6px; padding: 0; color: #4a5d52; font-size: 11px; font-weight: 600; line-height: normal; letter-spacing: 1px; }
#nice .plainly-zen-whitespace-toc-title { margin: 0; padding: 0; color: #2b2b2b; font-size: 13px; font-weight: 500; line-height: 1.5; }
#nice h3 { margin: 28px 0 14px; padding-left: 12px; border-left: 3px solid #4a5d52; font-family: ${SANS}; font-size: 16px; font-weight: 700; line-height: 1.5; color: #2b2b2b; }
#nice h4 { margin: 24px 0 12px; padding: 0 16px; font-size: 16px; font-weight: 700; line-height: 1.5; color: #2b2b2b; }
#nice h5 { margin: 20px 0 10px; padding: 0 16px; font-size: 15px; font-weight: 600; color: #2b2b2b; }
#nice h6 { margin: 18px 0 10px; padding: 0 16px; font-size: 13px; font-weight: 600; color: #a3a3a3; }
#nice p { margin: 0 0 26px; padding: 0 16px; font-size: 15px; line-height: 1.9; text-align: justify; color: #525252; }
#nice strong { font-weight: 600; color: #4a5d52; }
#nice em { font-style: italic; color: #737373; }
#nice a { color: #4a5d52; text-decoration: underline; overflow-wrap: break-word; }
#nice ul, #nice ol { margin: 0 0 26px; padding: 0 16px; }
#nice li { margin: 8px 0; font-size: 15px; line-height: 1.9; color: #2b2b2b; }
#nice li p { margin: 6px 0; }
#nice .plainly-zen-whitespace-intro-quote { margin: 32px 16px 48px; padding: 40px 24px; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; text-align: center; }
#nice .plainly-zen-whitespace-intro-quote-line { margin: 0 0 28px; padding: 0; font-family: ${SERIF}; font-size: 19px; font-weight: 600; line-height: 1.85; letter-spacing: 0.8px; text-align: center; color: #2b2b2b; }
#nice .plainly-zen-whitespace-intro-quote-line:last-child { margin-bottom: 0; }
#nice .plainly-zen-whitespace-intro-quote-signature { margin: 0; padding: 0; color: #a3a3a3; font-size: 12px; line-height: normal; letter-spacing: 1.5px; text-align: center; }
#nice .plainly-zen-whitespace-quote { margin: 40px 16px; padding: 36px 20px; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; text-align: center; }
#nice .plainly-zen-whitespace-quote > p { margin: 0 0 16px; padding: 0; font-family: ${SERIF}; font-size: 17px; font-weight: 600; line-height: 1.9; letter-spacing: 0.8px; text-align: center; color: #2b2b2b; }
#nice .plainly-zen-whitespace-quote > p:last-child { margin-bottom: 0; }
#nice .plainly-zen-whitespace-list { margin: 0 16px 32px; border-top: 1px solid #e8e8e8; }
#nice .plainly-zen-whitespace-list-row { display: flex; align-items: baseline; padding: 16px 0; border-bottom: 1px solid #e8e8e8; }
#nice .plainly-zen-whitespace-list-marker { min-width: 28px; margin: 0; padding: 0; color: #4a5d52; font-size: 11px; font-weight: 600; line-height: normal; letter-spacing: 1px; text-align: left; }
#nice .plainly-zen-whitespace-list-content { margin: 0; padding: 0 0 0 12px; color: #2b2b2b; font-size: 14px; line-height: 1.7; text-align: left; }
#nice .plainly-zen-whitespace-divider { padding: 0 16px; }
#nice .plainly-zen-whitespace-divider-line { height: 1px; margin: 64px 0 0; background: #e8e8e8; }
#nice .plainly-zen-whitespace-divider-end { display: flex; align-items: center; justify-content: center; margin: 48px 0 40px; text-align: center; }
#nice .plainly-zen-whitespace-divider-end-line { width: 48px; height: 1px; background: #e8e8e8; }
#nice .plainly-zen-whitespace-divider-end-line:first-child { margin-right: 16px; }
#nice .plainly-zen-whitespace-divider-end-line:last-child { margin-left: 16px; }
#nice .plainly-zen-whitespace-divider-end-label { color: #a3a3a3; font-size: 10px; font-weight: 400; letter-spacing: 4px; }
#nice p code, #nice li code, #nice blockquote code, #nice .plainly-zen-whitespace-quote code, #nice td code, #nice th code { padding: 2px 6px; border-radius: 2px; background-color: #eef3f0; color: #3d5046; font-family: ${SERIF}; font-size: 14px; font-weight: 600; }
#nice img { display: block; max-width: 100%; height: auto; margin: 32px auto; border: 1px solid #e8e8e8; border-radius: 0; }
#nice table { width: 100%; border-collapse: collapse; font-size: 14px; }
#nice table tr { border: 0; background-color: transparent; }
#nice table tr:nth-child(2n) { background-color: transparent; }
#nice table tr th { padding: 12px; border: 0; border-top: 1px solid #e8e8e8; border-bottom: 1px solid #e8e8e8; background-color: transparent; color: #2b2b2b; font-weight: 600; text-align: left; }
#nice table tr td { padding: 12px; border: 0; border-bottom: 1px solid #e8e8e8; background-color: transparent; color: #525252; line-height: 1.8; }
`,
};
