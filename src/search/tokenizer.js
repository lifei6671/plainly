import lunr from "lunr";

/**
 * 中文/混合文本：双字 bigram + 英文按词
 * @param {string} text
 * @returns {string[]}
 */
export default function zhBigrams(text) {
  const s = (text || "").replace(/[^\u4e00-\u9fff0-9a-zA-Z]+/g, " ").trim();

  const parts = s.split(/\s+/).filter(Boolean);
  const tokens = [];

  for (const p of parts) {
    const q = p.toLowerCase();
    if (q.length <= 2) {
      tokens.push(q);
      continue;
    }
    for (let i = 0; i < q.length - 1; i++) {
      tokens.push(q.slice(i, i + 2));
    }
  }
  return tokens;
}

// 全局 tokenizer：建议只设置一次（整个应用使用同一套分词策略）
lunr.tokenizer = function lunrTokenizer(obj) {
  if (obj == null) return [];
  return zhBigrams(String(obj)).map((t) => new lunr.Token(t));
};
