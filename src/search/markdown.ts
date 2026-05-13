import {unified} from "unified";
import remarkParse from "remark-parse";
import strip from "strip-markdown";
import remarkRemoveCode from "./remark-remove-code";

/**
 * Markdown -> 纯文本（删除代码块、去掉标记）
 * @param {string} md
 * @returns {Promise<string>}
 */
export default async function mdToTextNoCode(md) {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRemoveCode)
    .use(strip);
  const tree = await processor.run(processor.parse(md));
  const parts = [];
  const walk = (node) => {
    if (!node) return;
    if (node.type === "text" && node.value) {
      parts.push(node.value);
    }
    if (Array.isArray(node.children)) {
      node.children.forEach(walk);
    }
  };
  walk(tree);
  return parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
