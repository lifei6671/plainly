/**
 * 简单版本：最大更新时间 + 文档数量
 * @param {{updatedAt?: number}[]} docs
 * @returns {string}
 */
export const INDEX_SCHEMA_VERSION = 3;

export default function calcVersion(docs) {
  let max = 0;
  for (const d of docs) max = Math.max(max, d.updatedAt || 0);
  return `${INDEX_SCHEMA_VERSION}:${max}:${docs.length}`;
}
