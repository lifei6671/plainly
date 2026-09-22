import BASIC_THEME_CSS from "../../../template/basic";
import GITHUB_CODE_CSS from "../../../template/code/github";
import {BOX_ID, BASIC_THEME_ID, CODE_THEME_ID, FONT_THEME_ID, LAYOUT_ID, MARKDOWN_THEME_ID} from "../../../utils/constant";
import {solveHtml} from "../../../utils/converter";
import {markdownParser, markdownParserWechat} from "../../../utils/helper";
import {getThemeList, resolveThemeHtmlForTemplate, themeRegistry} from "../..";

export const TECH_DEPTH_TECHNICAL_ARTICLE = `# 从渲染管线理解主题迁移

主题迁移不是单纯的颜色替换。它要求 **结构语义**、*阅读节奏* 与 [导出约束](https://example.com/theme-contract) 同时成立，行内的 \`ThemeRegistry\` 仍应可读。

> 当预览 DOM 与导出 HTML 的结构不同，视觉回归会在复制到公众号后才出现。

## **渲染** *边界* [契约](https://example.com/render-contract)

### 数据流

- Markdown 先生成可预测的 HTML
  - 嵌套无序项保留自己的 \`ul\`
  - 内层文字仍可包含 **强调**
- Component Theme 只包装块级语义

1. Code Theme 负责 fenced code 的语法高亮
   1. 主题不改写 \`pre > code\`
   2. Juice 只内联最终 CSS
2. 公众号导出保留列表层级

\`inlineCode()\` 与公式 $O(n \\log n)$ 都在普通文本流中。

$$
T(n) = 2T(n / 2) + O(n)
$$

\`\`\`ts
const render = (markdown: string) => markdown.length;
\`\`\`

| 阶段 | 不变量 |
| --- | --- |
| Preview | H2 编号与行内节点保留 |
| Export | 组件样式被内联 |

![主题预览图](https://example.com/theme-preview.png "主题预览")

\`\`\`mermaid
flowchart LR
  Markdown --> Preview
  Preview --> Export
\`\`\`
`;

const addStyle = (id: string, css: string) => {
  const style = document.createElement("style");
  style.id = id;
  style.innerText = css;
  document.head.appendChild(style);
};

export const renderThemePreview = (themeId: string, markdown: string, parserMode: "standard" | "wechat" = "standard") => {
  const templateNum = getThemeList().findIndex((theme) => theme.id === themeId);
  if (templateNum < 0) {
    throw new Error(`Unknown theme: ${themeId}`);
  }

  const rawHtml = (parserMode === "wechat" ? markdownParserWechat : markdownParser).render(markdown);
  const previewHtml = resolveThemeHtmlForTemplate(templateNum, rawHtml);

  addStyle(BASIC_THEME_ID, BASIC_THEME_CSS);
  addStyle(MARKDOWN_THEME_ID, themeRegistry.resolveThemeCss(themeId) || "");
  addStyle(CODE_THEME_ID, GITHUB_CODE_CSS);
  addStyle(FONT_THEME_ID, "");
  document.body.innerHTML = `<div id="${BOX_ID}"><section id="${LAYOUT_ID}">${previewHtml}</section></div>`;

  return {rawHtml, previewHtml, preview: document.getElementById(LAYOUT_ID) as HTMLElement, exportHtml: solveHtml};
};
