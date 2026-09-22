import {createComponentThemeTransform, moveChildren} from "..";
import type {ComponentThemeDefinition} from "../../types";

const className = (name: string) => `plainly-zen-whitespace-${name}`;

export const ZEN_WHITESPACE_THEME: ComponentThemeDefinition = {
  id: "plainly-zen-whitespace",
  name: "留白禅意",
  category: "随笔阅读",
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
      const marker = context.document.createElement("span");
      marker.className = className("subsection-marker");
      marker.setAttribute("aria-hidden", "true");
      const title = context.document.createElement("span");
      title.className = className("subsection-title");
      moveChildren(source, title);
      section.append(marker, title);
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
  padding: 24px 18px 64px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 16px;
  line-height: 2;
  letter-spacing: 0.025em;
  color: #3f4d45;
  background-color: #fffefb;
  word-wrap: break-word;
}
#nice p {
  margin: 0 0 28px;
  padding: 0;
  font-size: 16px;
  line-height: 2;
  color: #3f4d45;
}
#nice strong {
  font-weight: 700;
  color: #34443b;
}
#nice em {
  font-style: italic;
  color: #65756b;
}
#nice a {
  color: #4A5D52;
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid #b8c4bb;
}
#nice h4 {
  margin: 38px 0 14px;
  font-size: 18px;
  line-height: 1.65;
  font-weight: 700;
  color: #4A5D52;
}
#nice h5 {
  margin: 32px 0 12px;
  font-size: 16px;
  line-height: 1.7;
  font-weight: 700;
  color: #596a60;
}
#nice h6 {
  margin: 28px 0 10px;
  font-size: 14px;
  line-height: 1.75;
  font-weight: 700;
  color: #718077;
}
#nice .plainly-zen-whitespace-title {
  margin: 64px 0 50px;
  padding: 0 0 28px;
  border-bottom: 1px solid #d8dfd8;
  text-align: center;
}
#nice .plainly-zen-whitespace-title-text {
  display: block;
  font-family: Georgia, "Songti SC", "SimSun", serif;
  font-size: 32px;
  line-height: 1.5;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: #3c4d42;
}
#nice .plainly-zen-whitespace-section {
  margin: 56px 0 26px;
  padding: 0 0 16px;
  border-bottom: 1px solid #d8dfd8;
}
#nice .plainly-zen-whitespace-section-number {
  display: inline-block;
  margin: 0 18px 0 2px;
  color: #9aa99f;
  font-size: 12px;
  line-height: 1.5;
  font-weight: 500;
  letter-spacing: 0.16em;
  vertical-align: baseline;
}
#nice .plainly-zen-whitespace-section-title {
  font-size: 23px;
  line-height: 1.55;
  font-weight: 600;
  color: #405146;
}
#nice .plainly-zen-whitespace-subsection {
  margin: 40px 0 18px;
}
#nice .plainly-zen-whitespace-subsection-marker {
  display: inline-block;
  width: 5px;
  height: 5px;
  margin: 0 10px 2px 0;
  background-color: #4A5D52;
}
#nice .plainly-zen-whitespace-subsection-title {
  font-size: 19px;
  line-height: 1.6;
  font-weight: 600;
  color: #53645a;
}
#nice .plainly-zen-whitespace-quote {
  margin: 42px 0;
  padding: 22px 18px;
  border-top: 1px solid #ccd6ce;
  border-bottom: 1px solid #ccd6ce;
  color: #607066;
  font-family: Georgia, "Songti SC", "SimSun", serif;
  text-align: center;
}
#nice .plainly-zen-whitespace-quote p {
  margin: 0 0 14px;
  padding: 0;
  color: #607066;
  font-size: 17px;
  line-height: 1.9;
  text-align: center;
}
#nice .plainly-zen-whitespace-quote p:last-child {
  margin-bottom: 0;
}
#nice .plainly-zen-whitespace-list {
  margin: 0 0 30px;
}
#nice .plainly-zen-whitespace-list ul {
  margin: 0;
  padding-left: 26px;
}
#nice .plainly-zen-whitespace-list ol {
  margin: 0;
  padding-left: 28px;
}
#nice .plainly-zen-whitespace-list li {
  margin: 12px 0;
  padding-left: 3px;
  line-height: 1.95;
  color: #47574d;
}
#nice .plainly-zen-whitespace-list li ul {
  margin: 12px 0 0;
  padding-left: 23px;
}
#nice .plainly-zen-whitespace-list li ol {
  margin: 12px 0 0;
  padding-left: 25px;
}
#nice .plainly-zen-whitespace-divider {
  width: 42px;
  height: 1px;
  margin: 52px auto;
  background-color: #aab8ae;
}
#nice p code,
#nice li code,
#nice .plainly-zen-whitespace-quote code,
#nice td code,
#nice th code {
  padding: 2px 5px;
  margin: 0;
  border: 1px solid #d7e0d9;
  border-radius: 2px;
  background-color: #f3f6f1;
  color: #4A5D52;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
}
#nice figure {
  margin: 36px 0;
}
#nice figure img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border: 1px solid #d9e1da;
}
#nice figcaption {
  margin: 12px 0 0;
  color: #7b887f;
  font-size: 13px;
  line-height: 1.7;
  text-align: center;
}
#nice table {
  width: 100%;
  margin: 32px 0 36px;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.75;
}
#nice table tr {
  border: 0;
  border-bottom: 1px solid #d9e1da;
  background-color: #fffefb;
}
#nice table tr:nth-child(2n) {
  background-color: #f7f9f5;
}
#nice table tr th {
  padding: 11px 12px;
  border: 1px solid #d3ddd5;
  background-color: #edf2eb;
  color: #4A5D52;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
}
#nice table tr td {
  padding: 11px 12px;
  border: 1px solid #dce4dd;
  background-color: #fffefb;
  color: #46564c;
  font-size: 14px;
  text-align: left;
}
`,
};
