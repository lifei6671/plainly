import {openDB} from "idb";

/**
 * meta: 存索引 JSON 与版本号
 * docs: 可选，存 id/title/content/updatedAt（用于回查与调试）
 */
export default function dbPromise() {
  return openDB("search-db", 1, {
    upgrade(db) {
      db.createObjectStore("meta");
      db.createObjectStore("docs");
    },
  });
}
