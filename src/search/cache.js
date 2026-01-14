import lunr from "lunr";
import dbPromise from "./db";

const INDEX_KEY = "lunrIndex";
const VERSION_KEY = "lunrIndexVersion";

/**
 * @param {string} version
 * @returns {Promise<lunr.Index|null>}
 */
export async function loadIndexIfFresh(version) {
  const db = await dbPromise();
  const cachedVer = await db.get("meta", VERSION_KEY);
  if (cachedVer !== version) return null;

  const json = await db.get("meta", INDEX_KEY);
  return json ? lunr.Index.load(json) : null;
}

/**
 * 直接读取缓存索引（不校验版本）
 * @returns {Promise<lunr.Index|null>}
 */
export async function loadIndex() {
  const db = await dbPromise();
  const json = await db.get("meta", INDEX_KEY);
  return json ? lunr.Index.load(json) : null;
}

/**
 * @param {lunr.Index} idx
 * @param {string} version
 */
export async function saveIndex(idx, version) {
  const db = await dbPromise();
  console.log("索引内容", idx.toJSON());
  await db.put("meta", idx.toJSON(), INDEX_KEY);
  await db.put("meta", version, VERSION_KEY);
}
