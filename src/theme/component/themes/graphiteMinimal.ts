import {createComponentThemeTransform, moveChildren} from "..";
import type {ComponentThemeDefinition} from "../../types";

/**
 * Rico MD gzh-design-skill adaptation mapping, not an original Plainly design.
 * Source: ricocc/rico-md@8c22fe5711365ffe646a0987b6d670d22511de58,
 * assets/styles/themes/gzh/graphite-minimal.js.
 * Copyright (C) 2026 Jiamu × Moyu Xiaoli. SPDX-License-Identifier: AGPL-3.0-or-later.
 * See Rico MD's docs/gzh-design-skill.md and licenses/gzh-design-skill.txt.
 */

const className = (name: string) => `plainly-graphite-minimal-${name}`;
const SANS = '-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif';
const MONO = 'Consolas,Menlo,Monaco,"Courier New",monospace';

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

const splitListItem = (item: Element) => {
  const clone = item.cloneNode(true) as Element;
  clone.querySelectorAll("p").forEach((paragraph) => {
    const parent = paragraph.parentNode as Node;
    while (paragraph.firstChild) parent.insertBefore(paragraph.firstChild, paragraph);
    parent.removeChild(paragraph);
  });
  const text = (clone.textContent || "").replace(/\s+/g, " ").trim();
  const colon = text.match(/^(.{1,14}?)\s*[：:]\s*(.+)$/);
  if (colon) {
    let descriptionNodes: Node[] | null = null;
    const first = clone.firstChild;
    if (first && first.nodeType === Node.TEXT_NODE) {
      const stripped = (first.nodeValue || "").replace(/^\s*[^：:]{1,14}?\s*[：:]\s*/, "");
      if (first.nodeValue !== stripped && !/^[：:]/.test(stripped)) {
        first.nodeValue = stripped;
        descriptionNodes = Array.from(clone.childNodes).filter((node) => {
          if (node.nodeType !== Node.TEXT_NODE) return true;
          return Boolean((node.nodeValue || "").trim());
        });
        if (descriptionNodes.length === 0) descriptionNodes = null;
      }
    }
    return {label: colon[1], description: colon[2], descriptionNodes};
  }
  return text.length <= 12 ? {label: text, description: "", descriptionNodes: null} : {label: "", description: text, descriptionNodes: null};
};

const appendListNodes = (nodes: Node[], content: Element, row: Element) => {
  nodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((node as Element).tagName)) {
      row.appendChild(node);
    } else {
      content.appendChild(node);
    }
  });
};

const moveListItem = (item: Element, content: Element, row: Element) => {
  while (item.firstChild) {
    const child = item.removeChild(item.firstChild);
    if (child.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((child as Element).tagName)) {
      row.appendChild(child);
    } else {
      content.appendChild(child);
    }
  }
};

const pill = (context: {document: Document}, label: string) => {
  const pillElement = context.document.createElement("span");
  pillElement.className = className("pill");
  const dot = context.document.createElement("span");
  dot.className = className("pill-dot");
  pillElement.append(dot, context.document.createTextNode(label));
  return pillElement;
};

const toFragment = (context: {document: Document}, nodes: Node[]) => {
  const fragment = context.document.createDocumentFragment();
  nodes.forEach((node) => fragment.appendChild(node));
  return fragment;
};

export const GRAPHITE_MINIMAL_THEME: ComponentThemeDefinition = {
  id: "plainly-graphite-minimal",
  name: "石墨极简",
  category: "极简阅读",
  author: "Jiamu × Moyu Xiaoli",
  source: "ricocc/rico-md: assets/styles/themes/gzh/graphite-minimal.js",
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
      section.className = `${className("chapter")} ${context.heading2Index === 1 ? className("chapter-first") : ""}`.trim();
      const frame = context.document.createElement("section");
      frame.className = className("chapter-frame");
      const number = context.document.createElement("p");
      number.className = className("chapter-number");
      number.textContent = isLastTopLevelTag(source, "H2") ? "∞" : String(context.heading2Index).padStart(2, "0");
      const titleBlock = context.document.createElement("section");
      titleBlock.className = className(tag ? "chapter-title-tagged" : "chapter-title");
      if (tag) {
        const label = context.document.createElement("p");
        label.className = className("chapter-label");
        label.textContent = tag;
        titleBlock.appendChild(label);
      }
      titleBlock.appendChild(heading);
      frame.append(number, titleBlock);
      section.appendChild(frame);

      if (context.heading2Index !== 1 || chapters.length < 3) return section;

      const toc = context.document.createElement("section");
      toc.className = className("toc");
      const tocLabel = context.document.createElement("p");
      tocLabel.className = className("toc-label");
      tocLabel.textContent = "本文看点";
      const cards = context.document.createElement("section");
      cards.className = className("toc-cards");
      chapters.slice(0, 3).forEach((item, index) => {
        const card = context.document.createElement("section");
        card.className = className(index === 2 ? "toc-card-last" : "toc-card");
        const cardNumber = context.document.createElement("p");
        cardNumber.className = className("toc-number");
        cardNumber.textContent = String(index + 1).padStart(2, "0");
        const cardTitle = context.document.createElement("p");
        cardTitle.className = className("toc-title");
        cardTitle.textContent = item.title || `第 ${index + 1} 节`;
        card.append(cardNumber, cardTitle);
        cards.appendChild(card);
      });
      toc.append(tocLabel, cards);
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
        if (last.startsWith("——") && last.length <= 20) signature = paragraphs.pop()?.textContent?.trim();
      }
      const label = context.document.createElement("p");
      label.className = className("intro-quote-label");
      label.textContent = "QUOTE";
      section.appendChild(label);
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
    ul: (source, context) =>
      toFragment(
        context,
        Array.from(source.children)
        .filter((child) => child.tagName === "LI")
        .map((item) => {
          const {label, description, descriptionNodes} = splitListItem(item);
          const row = context.document.createElement("section");
          row.className = className("unordered-row");
          const content = context.document.createElement("p");
          content.className = className("unordered-content");
          if (label) content.append(pill(context, label), context.document.createTextNode(" "));
          if (descriptionNodes) appendListNodes(descriptionNodes, content, row);
          else if (description && Array.from(item.children).some((child) => child.tagName === "UL" || child.tagName === "OL")) {
            moveListItem(item, content, row);
          } else if (description) content.appendChild(context.document.createTextNode(description));
          else if (!label) moveListItem(item, content, row);
          else return row;
          row.appendChild(content);
          return row;
        }),
      ),
    ol: (source, context) =>
      toFragment(
        context,
        Array.from(source.children)
        .filter((child) => child.tagName === "LI")
        .map((item, index) => {
          const row = context.document.createElement("section");
          row.className = className("ordered-row");
          const marker = context.document.createElement("span");
          marker.className = className("ordered-marker");
          marker.textContent = String(index + 1);
          const content = context.document.createElement("p");
          content.className = className("ordered-content");
          moveListItem(item, content, row);
          row.append(marker, content);
          return row;
        }),
      ),
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
#nice { box-sizing: border-box; margin: 0 auto; padding: 8px 0 32px; background-color: #ffffff; color: #52525b; font-family: ${SANS}; line-height: 1.8; letter-spacing: 0.3px; overflow-wrap: anywhere; }
#nice h1 { margin: 10px 10px 32px; padding: 0; font-family: ${SANS}; font-size: 22px; font-weight: 800; line-height: 1.4; color: #27272a; letter-spacing: 0.5px; }
#nice h2 { margin: 56px 0 32px; padding: 0 10px; font-family: ${SANS}; font-size: 20px; font-weight: 800; line-height: 1.4; color: #27272a; }
#nice h3 { margin: 28px 0 14px; padding-left: 12px; border-left: 3px solid #52525b; font-family: ${SANS}; font-size: 15px; font-weight: 800; line-height: 1.4; color: #27272a; }
#nice h4 { margin: 24px 0 12px; padding: 0 10px; font-size: 15px; font-weight: 800; line-height: 1.5; color: #27272a; }
#nice h5 { margin: 20px 0 10px; padding: 0 10px; font-size: 14px; font-weight: 700; color: #27272a; }
#nice h6 { margin: 18px 0 10px; padding: 0 10px; font-size: 13px; font-weight: 600; color: #a1a1aa; }
#nice p { margin: 0 0 22px; padding: 0 10px; font-size: 15px; line-height: 1.8; text-align: justify; color: #52525b; letter-spacing: 0.3px; }
#nice strong { font-weight: 700; color: #27272a; }
#nice em { font-style: italic; color: #71717a; }
#nice a { color: #52525b; font-weight: 600; text-decoration: underline; overflow-wrap: break-word; border-bottom: 0; }
#nice u { text-decoration: none; border-bottom: 2px solid #52525b; font-weight: 600; color: #27272a; }
#nice mark { background-color: #f4f4f5; color: #27272a; padding: 2px 7px; border-radius: 3px; font-weight: 700; }
#nice s { color: #a1a1aa; text-decoration: line-through; }
#nice ul, #nice ol { margin: 0 0 16px; padding: 0 10px; }
#nice li { margin: 8px 0; font-size: 15px; line-height: 1.8; color: #52525b; }
#nice li p { margin: 6px 0; }
#nice .plainly-graphite-minimal-chapter { margin: 56px 0 32px; padding: 0 10px; }
#nice .plainly-graphite-minimal-chapter-first { margin-top: 32px; }
#nice .plainly-graphite-minimal-chapter-frame { position: relative; padding-bottom: 20px; border-bottom: 1px solid #e4e4e7; }
#nice .plainly-graphite-minimal-chapter-number { margin: 0; padding: 0; color: #e4e4e7; font-size: 48px; font-weight: 900; line-height: 1; letter-spacing: -2px; }
#nice .plainly-graphite-minimal-chapter-title { margin-top: 8px; }
#nice .plainly-graphite-minimal-chapter-title-tagged { margin-top: -8px; }
#nice .plainly-graphite-minimal-chapter-label { margin: 0 0 6px; padding: 0; color: #a1a1aa; font-size: 10px; font-weight: 500; line-height: normal; letter-spacing: 3px; text-transform: uppercase; }
#nice .plainly-graphite-minimal-chapter h2 { margin: 0; padding: 0; font-family: ${SANS}; font-size: 20px; font-weight: 800; line-height: 1.4; color: #27272a; letter-spacing: 0.5px; }
#nice .plainly-graphite-minimal-toc { padding: 0 10px 40px; }
#nice .plainly-graphite-minimal-toc-label { margin: 0 0 16px; padding: 0; color: #a1a1aa; font-size: 11px; font-weight: 400; line-height: normal; letter-spacing: 2px; }
#nice .plainly-graphite-minimal-toc-cards { display: flex; justify-content: space-between; }
#nice .plainly-graphite-minimal-toc-card, #nice .plainly-graphite-minimal-toc-card-last { flex: 1; padding: 18px 12px 16px; border-top: 1px solid #e4e4e7; background: #fafafa; }
#nice .plainly-graphite-minimal-toc-card { margin-right: 8px; }
#nice .plainly-graphite-minimal-toc-number { margin: 0 0 8px; padding: 0; color: #a1a1aa; font-size: 11px; font-weight: 500; line-height: normal; letter-spacing: 1px; }
#nice .plainly-graphite-minimal-toc-title { margin: 0; padding: 0; color: #27272a; font-size: 13px; font-weight: 700; line-height: 1.5; }
#nice .plainly-graphite-minimal-intro-quote { margin: 10px 10px 40px; padding: 32px 24px 24px; border-top: 1px solid #e4e4e7; border-bottom: 1px solid #e4e4e7; background: #ffffff; }
#nice .plainly-graphite-minimal-intro-quote-label { margin: 0 0 18px; padding: 0; color: #a1a1aa; font-size: 11px; font-weight: 400; line-height: normal; letter-spacing: 2px; }
#nice .plainly-graphite-minimal-intro-quote-line { margin: 0 0 8px; padding: 0; color: #27272a; font-size: 18px; font-weight: 700; line-height: 1.7; letter-spacing: 0.5px; }
#nice .plainly-graphite-minimal-intro-quote-signature { margin: 16px 0 0; padding: 0; color: #a1a1aa; font-size: 12px; line-height: normal; letter-spacing: 1px; text-align: right; }
#nice .plainly-graphite-minimal-quote { margin: 24px 10px 28px; padding: 16px 0 16px 24px; border-left: 3px solid #52525b; }
#nice .plainly-graphite-minimal-quote > p { margin: 0 0 8px; padding: 0; color: #27272a; font-size: 16px; font-weight: 700; line-height: 1.7; letter-spacing: 0.5px; }
#nice .plainly-graphite-minimal-quote > p:last-child { margin-bottom: 0; }
#nice .plainly-graphite-minimal-unordered-row { margin: 0 10px 14px; }
#nice .plainly-graphite-minimal-unordered-content { margin: 0; padding: 0; color: #71717a; font-size: 14px; line-height: 1.7; text-align: justify; }
#nice .plainly-graphite-minimal-pill { display: inline-block; padding: 3px 10px; border-radius: 999px; background: #f4f4f5; color: #27272a; font-size: 14px; font-weight: 700; vertical-align: middle; }
#nice .plainly-graphite-minimal-pill-dot { display: inline-block; width: 6px; height: 6px; margin-right: 5px; border-radius: 50%; background: #52525b; vertical-align: middle; }
#nice .plainly-graphite-minimal-ordered-row { display: flex; align-items: flex-start; gap: 10px; margin: 0 10px 12px; }
#nice .plainly-graphite-minimal-ordered-marker { display: inline-flex; flex-shrink: 0; align-items: center; justify-content: center; width: 22px; height: 22px; margin-top: 2px; border-radius: 50%; background: #27272a; color: #fff; font-size: 12px; font-weight: 700; }
#nice .plainly-graphite-minimal-ordered-content { flex: 1; margin: 0; padding: 0; color: #52525b; font-size: 15px; line-height: 1.8; }
#nice .plainly-graphite-minimal-divider { padding: 0 10px; }
#nice .plainly-graphite-minimal-divider-line { height: 1px; margin: 0; background: #e4e4e7; }
#nice .plainly-graphite-minimal-divider-end { display: flex; align-items: center; justify-content: center; margin: 0 0 36px; text-align: center; }
#nice .plainly-graphite-minimal-divider-end-line { width: 48px; height: 1px; background: #e4e4e7; }
#nice .plainly-graphite-minimal-divider-end-line:first-child { margin-right: 16px; }
#nice .plainly-graphite-minimal-divider-end-line:last-child { margin-left: 16px; }
#nice .plainly-graphite-minimal-divider-end-label { color: #a1a1aa; font-size: 10px; font-weight: 500; letter-spacing: 4px; }
#nice p code, #nice li code, #nice .plainly-graphite-minimal-quote code, #nice td code, #nice th code { padding: 2px 6px; margin: 0; border: 0; border-radius: 4px; background-color: #f4f4f5; color: #27272a; font-family: ${MONO}; font-size: 14px; line-height: normal; word-wrap: normal; word-break: normal; }
#nice img { display: block; max-width: 100%; height: auto; margin: 24px auto; border: 1px solid #e4e4e7; border-radius: 0; }
#nice table { width: 100%; margin: 0; border-collapse: collapse; font-size: 14px; line-height: normal; }
#nice table tr { border: 0; background-color: #ffffff; }
#nice table tr:nth-child(2n) { background-color: #fafafa; }
#nice table tr th { padding: 10px 12px; border: 0; border-bottom: 1px solid #e4e4e7; background-color: #27272a; color: #ffffff; font-size: 14px; font-weight: 700; text-align: left; }
#nice table tr td { padding: 10px 12px; border: 0; border-bottom: 1px solid #e4e4e7; background-color: transparent; color: #52525b; font-size: 14px; line-height: 1.7; text-align: left; }
`,
};
