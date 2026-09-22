import {createComponentThemeTransform, moveChildren} from "..";
import type {ComponentThemeDefinition} from "../../types";

const className = (name: string) => `plainly-graphite-minimal-${name}`;

export const GRAPHITE_MINIMAL_THEME: ComponentThemeDefinition = {
  id: "plainly-graphite-minimal",
  name: "石墨极简",
  category: "极简阅读",
  author: "Plainly",
  source: "lifei6671/plainly",
  license: "GPL-3.0",
  isNew: true,
  mode: "component",
  transform: createComponentThemeTransform({
    h1: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("title");
      const title = context.document.createElement("span");
      title.className = className("title-text");
      moveChildren(source, title);
      section.appendChild(title);
      return section;
    },
    h2: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("section");
      const number = context.document.createElement("span");
      number.className = className("section-number");
      number.textContent = String(context.heading2Index).padStart(2, "0");
      const title = context.document.createElement("span");
      title.className = className("section-title");
      moveChildren(source, title);
      section.append(number, title);
      return section;
    },
    h3: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("subsection");
      const title = context.document.createElement("span");
      title.className = className("subsection-title");
      moveChildren(source, title);
      section.appendChild(title);
      return section;
    },
    blockquote: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("quote");
      moveChildren(source, section);
      return section;
    },
    ul: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("list");
      const list = source.cloneNode(false) as Element;
      moveChildren(source, list);
      section.appendChild(list);
      return section;
    },
    ol: (source, context) => {
      const section = context.document.createElement("section");
      section.className = className("list");
      const list = source.cloneNode(false) as Element;
      moveChildren(source, list);
      section.appendChild(list);
      return section;
    },
    hr: (_source, context) => {
      const section = context.document.createElement("section");
      section.className = className("divider");
      section.setAttribute("aria-hidden", "true");
      return section;
    },
  }),
  css: `
#nice {
  max-width: 100%;
  margin: 0 auto;
  padding: 16px 14px 48px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.9;
  letter-spacing: 0.018em;
  color: #3f3f46;
  background-color: #ffffff;
  word-wrap: break-word;
}
#nice p {
  margin: 0 0 22px;
  padding: 0;
  font-size: 16px;
  line-height: 1.9;
  color: #3f3f46;
}
#nice strong {
  font-weight: 700;
  color: #27272a;
}
#nice em {
  font-style: italic;
  color: #52525b;
}
#nice a {
  color: #52525b;
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid #a1a1aa;
}
#nice h4 {
  margin: 30px 0 12px;
  font-size: 18px;
  line-height: 1.55;
  font-weight: 700;
  color: #3f3f46;
}
#nice h5 {
  margin: 26px 0 10px;
  font-size: 16px;
  line-height: 1.6;
  font-weight: 700;
  color: #52525b;
}
#nice h6 {
  margin: 22px 0 8px;
  font-size: 14px;
  line-height: 1.65;
  font-weight: 700;
  color: #71717a;
}
#nice .plainly-graphite-minimal-title {
  margin: 48px 0 34px;
  padding: 0 0 20px;
  border-bottom: 1px solid #d4d4d8;
}
#nice .plainly-graphite-minimal-title-text {
  display: block;
  font-size: 31px;
  line-height: 1.38;
  font-weight: 700;
  letter-spacing: 0.012em;
  color: #27272a;
}
#nice .plainly-graphite-minimal-section {
  margin: 42px 0 20px;
  padding: 0 0 12px;
  border-bottom: 1px solid #d4d4d8;
}
#nice .plainly-graphite-minimal-section-number {
  display: inline-block;
  min-width: 30px;
  margin: 0 12px 0 0;
  padding: 2px 0;
  color: #71717a;
  font-size: 12px;
  line-height: 1.4;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-align: left;
}
#nice .plainly-graphite-minimal-section-title {
  font-size: 23px;
  line-height: 1.45;
  font-weight: 700;
  color: #3f3f46;
}
#nice .plainly-graphite-minimal-subsection {
  margin: 32px 0 14px;
  padding: 0 0 0 10px;
  border-left: 2px solid #a1a1aa;
}
#nice .plainly-graphite-minimal-subsection-title {
  font-size: 19px;
  line-height: 1.55;
  font-weight: 700;
  color: #52525b;
}
#nice .plainly-graphite-minimal-quote {
  margin: 26px 0;
  padding: 16px 18px;
  border-left: 2px solid #a1a1aa;
  background-color: #f4f4f5;
  color: #52525b;
}
#nice .plainly-graphite-minimal-quote p {
  margin: 0 0 12px;
  padding: 0;
  line-height: 1.85;
  color: #52525b;
}
#nice .plainly-graphite-minimal-quote p:last-child {
  margin-bottom: 0;
}
#nice .plainly-graphite-minimal-list {
  margin: 0 0 24px;
}
#nice .plainly-graphite-minimal-list ul {
  margin: 0;
  padding-left: 24px;
}
#nice .plainly-graphite-minimal-list ol {
  margin: 0;
  padding-left: 26px;
}
#nice .plainly-graphite-minimal-list li {
  margin: 9px 0;
  padding-left: 2px;
  line-height: 1.85;
  color: #3f3f46;
}
#nice .plainly-graphite-minimal-list li ul {
  margin: 9px 0 0;
  padding-left: 22px;
}
#nice .plainly-graphite-minimal-list li ol {
  margin: 9px 0 0;
  padding-left: 24px;
}
#nice .plainly-graphite-minimal-divider {
  width: 100%;
  height: 1px;
  margin: 38px 0;
  background-color: #d4d4d8;
}
#nice p code,
#nice li code,
#nice .plainly-graphite-minimal-quote code,
#nice td code,
#nice th code {
  padding: 2px 5px;
  margin: 0;
  border: 1px solid #d4d4d8;
  border-radius: 2px;
  background-color: #f4f4f5;
  color: #52525b;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
}
#nice figure {
  margin: 28px 0;
}
#nice figure img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border: 1px solid #d4d4d8;
}
#nice figcaption {
  margin: 10px 0 0;
  color: #71717a;
  font-size: 13px;
  line-height: 1.6;
  text-align: center;
}
#nice table {
  width: 100%;
  margin: 24px 0 28px;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.7;
}
#nice table tr {
  border: 0;
  border-bottom: 1px solid #d4d4d8;
  background-color: #ffffff;
}
#nice table tr:nth-child(2n) {
  background-color: #fafafa;
}
#nice table tr th {
  padding: 10px 12px;
  border: 1px solid #d4d4d8;
  background-color: #f4f4f5;
  color: #3f3f46;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
}
#nice table tr td {
  padding: 10px 12px;
  border: 1px solid #e4e4e7;
  background-color: #ffffff;
  color: #3f3f46;
  font-size: 14px;
  text-align: left;
}
`,
};
