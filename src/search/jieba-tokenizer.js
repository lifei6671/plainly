import lunr from "lunr";
// eslint-disable-next-line import/no-unresolved
import initJieba, {cut_for_search} from "jieba-wasm/web";
// eslint-disable-next-line import/no-unresolved
import wasmUrl from "../assets/wasm/jieba_rs_wasm_bg.wasm?url";

let jiebaReady = false;
let jiebaInitPromise = null;
let jiebaDisabled = false;

/**
 * 有些 wasm 包需要显式 init（取决于具体实现）
 * 如果你的 jieba-wasm 版本不需要 init，这个函数也不影响。
 */
export async function ensureJiebaReady() {
  if (jiebaReady) return true;
  if (jiebaDisabled) return false;
  if (!jiebaInitPromise) {
    jiebaInitPromise = (async () => {
      try {
        await initJieba(wasmUrl);
      } catch (err) {
        // Fallback: bypass instantiateStreaming by loading ArrayBuffer directly.
        try {
          const resp = await fetch(wasmUrl, {cache: "reload"});
          if (!resp.ok) {
            throw new Error(`Failed to fetch wasm: ${resp.status}`);
          }
          const buffer = await resp.arrayBuffer();
          await initJieba(buffer);
        } catch (fallbackErr) {
          console.error("jieba-wasm fallback init failed:", fallbackErr);
          throw err;
        }
      }
      jiebaReady = true;
      console.log("jieba-wasm 初始化成功 -> ", wasmUrl);
    })();
  }
  try {
    await jiebaInitPromise;
    return true;
  } catch (err) {
    jiebaInitPromise = null;
    jiebaDisabled = true;
    console.error("jieba-wasm init failed, fallback to default tokenizer:", err);
    return false;
  }
}

export function isJiebaReady() {
  return jiebaReady;
}

function normalizeToken(raw) {
  const t = (raw || "").trim();
  if (!t) return "";
  if (/^[^\u4e00-\u9fff0-9a-zA-Z]+$/.test(t)) return "";
  return t.toLowerCase();
}

export function tokenizeForSearch(text) {
  const value = String(text || "").trim();
  if (!value) return [];
  if (!jiebaReady) {
    return lunr
      .tokenizer(value)
      .map((token) => normalizeToken(String(token)))
      .filter(Boolean);
  }
  return cut_for_search(value).map(normalizeToken).filter(Boolean);
}

/**
 * 把 jieba 分词结果转换成 lunr.Token[]
 * 注意：lunr.tokenizer 必须是同步函数，所以这里不能 await。
 */
export function jiebaLunrTokenizer(obj) {
  if (obj == null) return [];

  const text = String(obj).trim();
  if (!text) return [];

  // cut_for_search 返回词数组
  const words = cut_for_search(text);
  return words
    .map(normalizeToken)
    .filter(Boolean)
    .map((token) => new lunr.Token(token));
}
