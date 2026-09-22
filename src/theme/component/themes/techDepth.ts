import {createComponentThemeTransform, moveChildren} from "..";
import type {ComponentThemeDefinition} from "../../types";

const className = (name: string) => `plainly-tech-depth-${name}`;

export const TECH_DEPTH_THEME: ComponentThemeDefinition = {
  id: "plainly-tech-depth",
  name: "技术深读",
  category: "技术阅读",
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
  padding: 12px 10px 40px;
  font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.82;
  letter-spacing: 0.018em;
  color: #202936;
  background-color: #ffffff;
  word-wrap: break-word;
}
#nice p {
  margin: 0 0 20px;
  padding: 0;
  font-size: 16px;
  line-height: 1.82;
  color: #202936;
}
#nice strong {
  font-weight: 700;
  color: #18212c;
}
#nice em {
  font-style: italic;
  color: #506070;
}
#nice a {
  color: #456681;
  font-weight: 500;
  text-decoration: none;
  border-bottom: 1px solid #a9bbc9;
}
#nice h4 {
  margin: 28px 0 12px;
  font-size: 18px;
  line-height: 1.5;
  font-weight: 700;
  color: #263849;
}
#nice h5 {
  margin: 24px 0 10px;
  font-size: 16px;
  line-height: 1.55;
  font-weight: 700;
  color: #394d60;
}
#nice h6 {
  margin: 20px 0 8px;
  font-size: 14px;
  line-height: 1.6;
  font-weight: 700;
  color: #5a6a79;
}
#nice .plainly-tech-depth-title {
  margin: 40px 0 30px;
  padding: 0 0 18px;
  border-bottom: 3px solid #5b7892;
}
#nice .plainly-tech-depth-title-text {
  display: block;
  font-size: 30px;
  line-height: 1.34;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #172331;
}
#nice .plainly-tech-depth-section {
  margin: 38px 0 18px;
  padding: 0 0 11px;
  border-bottom: 1px solid #c9d5de;
}
#nice .plainly-tech-depth-section-number {
  display: inline-block;
  min-width: 34px;
  margin: 0 10px 0 0;
  padding: 3px 5px;
  background-color: #e7eef3;
  color: #4a6982;
  font-size: 13px;
  line-height: 1.2;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: center;
}
#nice .plainly-tech-depth-section-title {
  font-size: 23px;
  line-height: 1.4;
  font-weight: 700;
  color: #223445;
}
#nice .plainly-tech-depth-subsection {
  margin: 30px 0 14px;
  padding: 0 0 0 11px;
  border-left: 3px solid #7894aa;
}
#nice .plainly-tech-depth-subsection-marker {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin: 0 8px 2px 0;
  background-color: #7894aa;
}
#nice .plainly-tech-depth-subsection-title {
  font-size: 19px;
  line-height: 1.48;
  font-weight: 700;
  color: #31485c;
}
#nice .plainly-tech-depth-quote {
  margin: 24px 0;
  padding: 14px 17px;
  border-left: 4px solid #7b98ad;
  background-color: #f2f6f8;
  color: #405565;
}
#nice .plainly-tech-depth-quote p {
  margin: 0 0 12px;
  padding: 0;
  line-height: 1.78;
  color: #405565;
}
#nice .plainly-tech-depth-quote p:last-child {
  margin-bottom: 0;
}
#nice .plainly-tech-depth-list {
  margin: 0 0 22px;
}
#nice .plainly-tech-depth-list ul {
  margin: 0;
  padding-left: 25px;
}
#nice .plainly-tech-depth-list ol {
  margin: 0;
  padding-left: 27px;
}
#nice .plainly-tech-depth-list li {
  margin: 8px 0;
  padding-left: 2px;
  line-height: 1.78;
  color: #263846;
}
#nice .plainly-tech-depth-list li ul {
  margin: 8px 0 0;
  padding-left: 22px;
}
#nice .plainly-tech-depth-list li ol {
  margin: 8px 0 0;
  padding-left: 24px;
}
#nice .plainly-tech-depth-divider {
  width: 44px;
  height: 2px;
  margin: 36px auto;
  background-color: #8aa1b2;
}
#nice p code,
#nice li code,
#nice .plainly-tech-depth-quote code,
#nice td code,
#nice th code {
  padding: 2px 5px;
  margin: 0;
  border: 1px solid #d6e0e7;
  border-radius: 2px;
  background-color: #f2f5f7;
  color: #38546b;
  font-family: Consolas, "Courier New", monospace;
  font-size: 13px;
  line-height: 1.4;
  word-wrap: break-word;
  word-break: break-word;
}
#nice figure {
  margin: 24px 0;
}
#nice figure img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: 0 auto;
  border: 1px solid #d9e1e6;
}
#nice figcaption {
  margin: 9px 0 0;
  color: #657684;
  font-size: 13px;
  line-height: 1.55;
  text-align: center;
}
#nice table {
  width: 100%;
  margin: 22px 0 26px;
  border-collapse: collapse;
  font-size: 14px;
  line-height: 1.65;
}
#nice table tr {
  border: 0;
  border-bottom: 1px solid #d5dfe5;
  background-color: #ffffff;
}
#nice table tr:nth-child(2n) {
  background-color: #f7fafc;
}
#nice table tr th {
  padding: 10px 12px;
  border: 1px solid #cbd7df;
  background-color: #e9f0f4;
  color: #2c465c;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
}
#nice table tr td {
  padding: 10px 12px;
  border: 1px solid #d5dfe5;
  background-color: #ffffff;
  color: #2c3c4a;
  font-size: 14px;
  text-align: left;
}
`,
};
