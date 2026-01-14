import lunr from "lunr";
import {openDB} from "idb";
import mdToTextNoCode from "./markdown";
import buildIndex from "./lunr-index";
import {loadIndex, loadIndexIfFresh, saveIndex} from "./cache";
import dbPromise from "./db";
import calcVersion, {INDEX_SCHEMA_VERSION} from "./version";
import {ensureJiebaReady, tokenizeForSearch} from "./jieba-tokenizer";

const ARTICLES_DB_NAME = "articles";
const ARTICLE_META_STORE = "article_meta";
const ARTICLE_CONTENT_STORE = "article_content";
const LEGACY_ARTICLES_STORE = "articles";
const DIRTY_KEY = "lunrIndexDirty";
const IDLE_TIMEOUT_MS = 2000;

let rebuildScheduled = false;
let rebuildPromise = null;

/**
 * 有限并发 map：每批并发 limit 个任务
 * @template T,R
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T, index: number) => Promise<R>} fn
 * @returns {Promise<R[]>}
 */
export async function mapLimit(items, limit, fn) {
  const res = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    // eslint-disable-next-line no-await-in-loop
    const chunkRes = await Promise.all(chunk.map((item, j) => fn(item, i + j)));
    res.push(...chunkRes);
  }
  return res;
}

function toTimestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (value == null) return 0;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function openArticlesDb() {
  try {
    return await openDB(ARTICLES_DB_NAME);
  } catch (e) {
    console.error(e);
    return null;
  }
}

async function getDirtyToken() {
  const db = await dbPromise();
  const token = await db.get("meta", DIRTY_KEY);
  return typeof token === "number" ? token : 0;
}

async function setDirtyToken(value) {
  const db = await dbPromise();
  await db.put("meta", value, DIRTY_KEY);
}

export async function markIndexDirty() {
  const token = await getDirtyToken();
  await setDirtyToken(token + 1);
}

export async function isIndexDirty() {
  return (await getDirtyToken()) > 0;
}

export function scheduleIndexRebuild() {
  if (rebuildScheduled) return;
  rebuildScheduled = true;

  const run = async () => {
    rebuildScheduled = false;
    try {
      if (!(await isIndexDirty())) return;
      await rebuildIndexNow();
    } catch (e) {
      console.error(e);
    }
  };

  const idleCallback = typeof window !== "undefined" ? window.requestIdleCallback : null;
  if (typeof idleCallback === "function") {
    idleCallback(() => run(), {timeout: IDLE_TIMEOUT_MS});
  } else {
    setTimeout(run, 1500);
  }
}

async function getDocsVersionFast() {
  const db = await openArticlesDb();
  if (!db) return "0:0";

  const hasMeta = db.objectStoreNames.contains(ARTICLE_META_STORE);
  const hasLegacy = db.objectStoreNames.contains(LEGACY_ARTICLES_STORE);
  if (!hasMeta && !hasLegacy) return "0:0";

  const metaItems = hasMeta ? await db.getAll(ARTICLE_META_STORE) : [];
  const legacyItems = hasLegacy ? await db.getAll(LEGACY_ARTICLES_STORE) : [];

  const seen = new Set();
  let maxUpdatedAt = 0;
  let count = 0;

  for (const item of metaItems) {
    const id = item?.document_id ?? item?.id;
    if (id == null) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
    maxUpdatedAt = Math.max(maxUpdatedAt, toTimestamp(item.updatedAt || item.createdAt));
  }

  for (const item of legacyItems) {
    const id = item?.document_id ?? item?.id;
    if (id == null) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
    maxUpdatedAt = Math.max(maxUpdatedAt, toTimestamp(item.updatedAt || item.createdAt));
  }

  return `${INDEX_SCHEMA_VERSION}:${maxUpdatedAt}:${count}`;
}

async function buildRawDocsFromArticles() {
  const db = await openArticlesDb();
  if (!db) return [];

  const hasMeta = db.objectStoreNames.contains(ARTICLE_META_STORE);
  const hasContent = db.objectStoreNames.contains(ARTICLE_CONTENT_STORE);
  const hasLegacy = db.objectStoreNames.contains(LEGACY_ARTICLES_STORE);

  const metaItems = hasMeta ? await db.getAll(ARTICLE_META_STORE) : [];
  const contentItems = hasContent ? await db.getAll(ARTICLE_CONTENT_STORE) : [];
  const legacyItems = hasLegacy ? await db.getAll(LEGACY_ARTICLES_STORE) : [];

  const contentById = new Map();
  contentItems.forEach((item) => {
    if (item && item.document_id != null) {
      contentById.set(String(item.document_id), item.content || "");
    }
  });

  const legacyById = new Map();
  legacyItems.forEach((item) => {
    const id = item?.document_id ?? item?.id;
    if (id == null) return;
    const key = String(id);
    if (!legacyById.has(key) && item?.content != null) {
      legacyById.set(key, item.content);
    }
  });

  const docs = [];
  const seen = new Set();

  for (const meta of metaItems) {
    const id = meta?.document_id ?? meta?.id;
    if (id == null) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    docs.push({
      id: key,
      title: meta.name || "",
      markdown: contentById.get(key) ?? legacyById.get(key) ?? "",
      updatedAt: toTimestamp(meta.updatedAt || meta.createdAt),
    });
  }

  for (const legacy of legacyItems) {
    const id = legacy?.document_id ?? legacy?.id;
    if (id == null) continue;
    const key = String(id);
    if (seen.has(key)) continue;
    seen.add(key);
    docs.push({
      id: key,
      title: legacy.name || "",
      markdown: legacy.content || "",
      updatedAt: toTimestamp(legacy.updatedAt || legacy.createdAt),
    });
  }

  return docs;
}

/**
 * 初始化搜索：
 * - 命中缓存：直接 load
 * - 未命中：Markdown->Text(无代码) + 建索引 + 写入 IndexedDB
 *
 * @param {{id:string,title?:string,markdown?:string,updatedAt?:number}[]} rawDocs
 * @param {{concurrency?:number, persistDocs?:boolean, forceRebuild?:boolean}} [opts]
 * @returns {Promise<{idx: any, version: string, fromCache: boolean}>}
 */
export async function initSearch(rawDocs, opts = {}) {
  const concurrency = Math.max(1, opts.concurrency || 4); // iOS 建议 2~4；桌面 6~10
  const persistDocs = opts.persistDocs !== false; // 默认 true，便于回查/做 snippet
  const forceRebuild = opts.forceRebuild === true;

  const version = calcVersion(rawDocs);

  console.log("尝试初始化 Lunr 索引文件");

  // 1) 尝试走缓存
  if (!forceRebuild) {
    const cached = await loadIndexIfFresh(version);
    if (cached) {
      console.log("从缓存中加载 Lunr 索引 -> ", version);
      return {idx: cached, version, fromCache: true};
    }
  }

  // 2) 有限并发：Markdown -> 纯文本（去代码块）
  console.log("开始初始化 Lunr 索引 -> ", version);
  const docs = await mapLimit(rawDocs, concurrency, async (d) => ({
    id: d.id,
    title: d.title || "",
    content: await mdToTextNoCode(d.markdown || ""),
    updatedAt: d.updatedAt || 0,
  }));

  // 3) 可选：写 docs（单事务批量写，减少 IO 次数）
  if (persistDocs) {
    const db = await dbPromise();
    const tx = db.transaction("docs", "readwrite");
    for (const d of docs) tx.store.put(d, d.id);
    await tx.done;
  }
  console.log("构建索引文件并储存");
  // 4) 建索引 + 缓存索引 JSON
  const idx = await buildIndex(docs);
  await saveIndex(idx, version);

  return {idx, version, fromCache: false};
}

/**
 * 搜索：直接 idx.search，Lunr 会走 tokenizer + pipeline
 * @param {Index|*} idx
 * @param {string} q
 */
export function search(idx, q) {
  const terms = tokenizeForSearch(q);
  if (terms.length === 0) return [];
  console.log("Searching articles with query:", terms);
  const uniqueTerms = Array.from(new Set(terms));
  return idx.query((query) => {
    uniqueTerms.forEach((term) => {
      query.term(term, {
        fields: ["title", "content"],
        presence: lunr.Query.presence.REQUIRED,
      });
    });
  });
}

/**
 * 读取文档（用于把 ref 映射回文档，或生成 snippet）
 * @param {string} id
 */
export async function getDocById(id) {
  const db = await dbPromise();
  return db.get("docs", id);
}

/**
 * 重建索引
 * @returns {Promise<{idx: Index, version: string, fromCache: boolean}|{idx: Index|*, version: string, fromCache: boolean}>}
 */
export async function rebuildIndexNow() {
  if (rebuildPromise) return rebuildPromise;

  rebuildPromise = (async () => {
    const dirtyToken = await getDirtyToken();
    const rawDocs = await buildRawDocsFromArticles();
    const result = await initSearch(rawDocs, {concurrency: 12, forceRebuild: true});

    const latestToken = await getDirtyToken();
    if (latestToken === dirtyToken) {
      await setDirtyToken(0);
    } else {
      scheduleIndexRebuild();
    }
    return result;
  })();

  try {
    return await rebuildPromise;
  } finally {
    rebuildPromise = null;
  }
}

/**
 * 加载或初始化索引
 * @returns {Promise<Index|Index|*>}
 */
export async function ensureIndexReady() {
  await ensureJiebaReady();
  const dirty = await isIndexDirty();
  const version = await getDocsVersionFast();

  if (!dirty) {
    const cached = await loadIndexIfFresh(version);
    if (cached) return cached;
  }

  if (dirty) {
    const cached = await loadIndex();
    if (cached) {
      scheduleIndexRebuild();
      return cached;
    }
  }

  const {idx} = await rebuildIndexNow();
  return idx;
}
