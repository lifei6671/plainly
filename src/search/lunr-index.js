import lunr from "lunr";
import {ensureJiebaReady, jiebaLunrTokenizer} from "./jieba-tokenizer";

/**
 * @typedef {{ id: string, title: string, content: string }} IndexDoc
 */

/**
 * 构建 lunr 索引
 * 注意：必须使用 function()，不要用箭头函数，否则 this 绑定会错
 * @param {IndexDoc[]} docs
 * @returns {lunr.Index}
 */
// export default function buildIndex(docs) {
//   return lunr(function() {
//     this.ref("id");
//     this.field("title", {boost: 10});
//     this.field("content");
//     // Avoid English-only pipeline removing CJK tokens.
//     this.pipeline.reset();
//     this.searchPipeline.reset();
//
//     for (const d of docs) {
//       this.add(d);
//     }
//   });
// }

export default async function buildIndex(docs) {
  await ensureJiebaReady();

  // 全局覆盖 tokenizer（lunr 是单例 tokenizer 模型）
  lunr.tokenizer = jiebaLunrTokenizer;

  return lunr(function buildIndexConfig() {
    // 关键：中文建议清空默认 pipeline
    this.pipeline.reset();
    this.searchPipeline.reset();

    this.ref("id");
    this.field("title", {boost: 10});
    this.field("content");

    for (const d of docs) this.add(d);
  });
}
