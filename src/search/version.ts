/**
 * 简单版本：最大更新时间 + 文档数量
 * @param {{updatedAt?: number}[]} docs
 * @param {string} [mode]
 * @returns {string}
 */
export const INDEX_SCHEMA_VERSION = 4;

export default function calcVersion(docs, mode = "jieba") {
  let max = 0;
  for (const d of docs) max = Math.max(max, d.updatedAt || 0);
  return `${INDEX_SCHEMA_VERSION}:${mode}:${max}:${docs.length}`;
}
