import IndexDB from "../../../component/LocalHistory/indexdb";
import {countVisibleChars} from "../../../utils/helper";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../../utils/constant";
import {Category, CategoryWithCount, DocumentMeta, NewDocumentPayload, UpdateDocumentMetaInput} from "../types";
import {IDataStore} from "../IDataStore";

type CategoriesById = Map<number, Category>;
type CategoriesByName = Map<string, number>;

export class BrowserDataStore implements IDataStore {
  private readonly userId: number;

  constructor(userId = 0) {
    this.userId = Number.isFinite(userId) ? Number(userId) : 0;
  }

  // 持有单例的 IDB 连接
  private db: IDBDatabase | null = null;

  // 避免重复初始化的 promise
  private initPromise: Promise<IDBDatabase> | null = null;

  // 配置存储的内存兜底（非浏览器环境或 localStorage 不可用时）
  private configFallback = new Map<string, string>();

  private getConfigStorage(): Storage | null {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    return null;
  }

  async init() {
    await this.getDb();
  }

  private async getDb(): Promise<IDBDatabase> {
    if (this.db) {
      return this.db;
    }
    if (!this.initPromise) {
      // 初始化 IndexedDB，并在升级时创建表与索引
      const indexDB = new IndexDB({
        name: "articles",
        version: 4,
        storeName: "article_meta",
        storeOptions: {keyPath: "document_id", autoIncrement: true},
        storeInit: (objectStore, db, transaction) => {
          // 文章元数据索引：名称/创建时间/更新时间/目录
          if (objectStore && !objectStore.indexNames.contains("name")) {
            objectStore.createIndex("name", "name", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("uid")) {
            objectStore.createIndex("uid", "uid", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("createdAt")) {
            objectStore.createIndex("createdAt", "createdAt", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("updatedAt")) {
            objectStore.createIndex("updatedAt", "updatedAt", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("category")) {
            objectStore.createIndex("category", "category", {unique: false});
          }
          // 文章正文存储
          if (db && !db.objectStoreNames.contains("article_content")) {
            const contentStore = db.createObjectStore("article_content", {keyPath: "document_id"});
            contentStore.createIndex("uid", "uid", {unique: false});
          } else if (transaction && transaction.objectStoreNames.contains("article_content")) {
            const contentStore = transaction.objectStore("article_content");
            if (contentStore && !contentStore.indexNames.contains("uid")) {
              contentStore.createIndex("uid", "uid", {unique: false});
            }
          }
          // 目录表，带默认目录
          if (db) {
            const shouldCreate = !db.objectStoreNames.contains("categories");
            let categoriesStore: IDBObjectStore | null = null;
            if (shouldCreate) {
              categoriesStore = db.createObjectStore("categories", {keyPath: "id", autoIncrement: true});
            } else if (transaction && transaction.objectStoreNames.contains("categories")) {
              categoriesStore = transaction.objectStore("categories");
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("uid")) {
              categoriesStore.createIndex("uid", "uid", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("name")) {
              categoriesStore.createIndex("name", "name", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("createdAt")) {
              categoriesStore.createIndex("createdAt", "createdAt", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("updatedAt")) {
              categoriesStore.createIndex("updatedAt", "updatedAt", {unique: false});
            }
            if (shouldCreate && categoriesStore) {
              const now = new Date();
              categoriesStore.add({
                id: DEFAULT_CATEGORY_ID,
                name: DEFAULT_CATEGORY_NAME,
                createdAt: now,
                updatedAt: now,
                uid: this.userId,
              });
            }
          }
          // 用户表，便于与后端结构对齐（浏览器模式默认 uid = 0）
          if (db && !db.objectStoreNames.contains("users")) {
            const usersStore = db.createObjectStore("users", {keyPath: "id", autoIncrement: true});
            usersStore.createIndex("account", "account", {unique: true});
            const now = new Date();
            usersStore.put({
              id: 0,
              account: "local",
              registered_at: now,
              last_login_at: now,
              last_login_ip: "0.0.0.0",
              status: 1,
              updated_at: now,
            });
          }
        },
      });
      this.initPromise = indexDB.init();
    }
    this.db = await this.initPromise;
    return this.db;
  }

  private async ensureDefaultCategory(db?: IDBDatabase): Promise<Category | null> {
    const database = db || (await this.getDb());
    if (!database || !database.objectStoreNames.contains("categories")) {
      return null;
    }
    // 确保默认目录存在，不存在则自动写入
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(["categories"], "readwrite");
      const store = transaction.objectStore("categories");
      const request = store.get(DEFAULT_CATEGORY_ID);
      request.onsuccess = () => {
        const current = (request.result || null) as Category | null;
        if (current) {
          if (!current.uid && this.userId !== undefined) {
            store.put({...current, uid: this.userId});
          }
          resolve(current);
          return;
        }
        const now = new Date();
        const payload: Category = {
          id: DEFAULT_CATEGORY_ID,
          name: DEFAULT_CATEGORY_NAME,
          createdAt: now,
          updatedAt: now,
          uid: this.userId,
        };
        const addReq = store.add(payload);
        addReq.onsuccess = () => resolve(payload);
        addReq.onerror = () => resolve(payload);
      };
      request.onerror = (event) => reject(event);
    });
  }

  private getTimeValue(value: unknown): number {
    if (value instanceof Date) {
      return value.getTime();
    }
    if (value == null) {
      return 0;
    }
    const parsed = new Date(value as never).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private normalizeUid(value: unknown): number {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return 0;
  }

  private belongsToCurrentUser(uid: unknown): boolean {
    return this.normalizeUid(uid) === this.userId;
  }

  private sortCategories(categories: Category[]): Category[] {
    // 默认目录永远排在最前，其余按创建时间升序
    return categories.slice().sort((a, b) => {
      if (a.id === DEFAULT_CATEGORY_ID) return -1;
      if (b.id === DEFAULT_CATEGORY_ID) return 1;
      return this.getTimeValue(a.createdAt) - this.getTimeValue(b.createdAt);
    });
  }

  private normalizeCategory(
    value: unknown,
    categoriesById: CategoriesById,
    categoriesByName: CategoriesByName,
  ): number {
    // 兼容数字或字符串的旧数据，将目录归一化到合法 ID
    if (typeof value === "number" && categoriesById.has(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (categoriesByName.has(trimmed)) {
        return categoriesByName.get(trimmed) as number;
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && categoriesById.has(parsed)) {
        return parsed;
      }
    }
    return DEFAULT_CATEGORY_ID;
  }

  async listCategories(): Promise<Category[]> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      return [];
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["categories"], "readonly");
      const store = transaction.objectStore("categories");
      const items: Category[] = [];
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value as Category;
          if (this.belongsToCurrentUser((value as any).uid ?? 0)) {
            items.push(value);
          }
          cursor.continue();
        } else {
          resolve(this.sortCategories(items));
        }
      };
      request.onerror = (event) => reject(event);
    });
  }

  private async collectCategoryCounts(categories: Category[]): Promise<Map<number, number>> {
    const db = await this.getDb();
    const counts = new Map<number, number>();
    if (!db.objectStoreNames.contains("article_meta")) {
      return counts;
    }
    // 构建目录索引方便归一化
    const categoriesById: CategoriesById = new Map();
    const categoriesByName: CategoriesByName = new Map();
    categories.forEach((category) => {
      categoriesById.set(category.id, category);
      if (category.name) {
        categoriesByName.set(category.name, category.id);
      }
    });
    // 遍历文章元数据，统计数量并顺便修正脏数据
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["article_meta"], "readwrite");
      const store = transaction.objectStore("article_meta");
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          return;
        }
        const record = (cursor.value || {}) as DocumentMeta;
        if (!this.belongsToCurrentUser((record as any).uid ?? 0)) {
          cursor.continue();
          return;
        }
        const nextCategoryId = this.normalizeCategory(record.category, categoriesById, categoriesByName);
        if (record.category !== nextCategoryId) {
          cursor.update({...record, category: nextCategoryId});
        }
        counts.set(nextCategoryId, (counts.get(nextCategoryId) || 0) + 1);
        cursor.continue();
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve(counts);
      transaction.onerror = (event) => reject(event);
    });
  }

  async listCategoriesWithCount(): Promise<CategoryWithCount[]> {
    const categories = await this.listCategories();
    const counts = await this.collectCategoryCounts(categories);
    return categories.map((category) => ({
      ...category,
      count: counts.get(category.id) || 0,
    }));
  }

  async createCategory(name: string): Promise<Category> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      throw new Error("categories store not found");
    }
    // 写入新目录并返回生成的自增 ID
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["categories"], "readwrite");
      const store = transaction.objectStore("categories");
      const now = new Date();
      const request = store.add({
        name,
        createdAt: now,
        updatedAt: now,
        uid: this.userId,
      });
      let createdId: number | null = null;
      request.onsuccess = (event) => {
        createdId = (event.target as IDBRequest<number>).result;
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => {
        if (createdId == null) {
          reject(new Error("create category failed"));
        } else {
          resolve({
            id: createdId,
            name,
            createdAt: now,
            updatedAt: now,
            uid: this.userId,
          });
        }
      };
      transaction.onerror = (event) => reject(event);
    });
  }

  async renameCategory(id: number, name: string): Promise<void> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      return;
    }
    // 更新目录名称与更新时间
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["categories"], "readwrite");
      const store = transaction.objectStore("categories");
      const request = store.get(id);
      request.onsuccess = () => {
        const current = (request.result || null) as Category | null;
        if (!current) {
          resolve();
          return;
        }
        if (!this.belongsToCurrentUser((current as any).uid ?? 0)) {
          resolve();
          return;
        }
        store.put({
          ...current,
          name,
          updatedAt: new Date(),
        });
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async deleteCategory(id: number, options?: {reassignTo?: number}): Promise<void> {
    const db = await this.getDb();
    const reassignTo = options?.reassignTo ?? DEFAULT_CATEGORY_ID;
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      return;
    }
    const owned = await new Promise<Category | null>((resolve, reject) => {
      const tx = db.transaction(["categories"], "readonly");
      const store = tx.objectStore("categories");
      const req = store.get(id);
      req.onsuccess = () => {
        const result = (req.result || null) as Category | null;
        if (result && !this.belongsToCurrentUser((result as any).uid ?? 0)) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      req.onerror = (event) => reject(event);
    });
    if (!owned) return;
    // 删除目录，同时将该目录下文章迁移到指定目录（默认迁移到默认目录）
    return new Promise((resolve, reject) => {
      const stores: string[] = ["categories"];
      if (db.objectStoreNames.contains("article_meta")) {
        stores.push("article_meta");
      }
      if (db.objectStoreNames.contains("articles")) {
        stores.push("articles");
      }
      const transaction = db.transaction(stores, "readwrite");
      const categoryStore = transaction.objectStore("categories");
      categoryStore.delete(id);
      if (stores.includes("article_meta")) {
        const metaStore = transaction.objectStore("article_meta");
        const request = metaStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            return;
          }
          const record = (cursor.value || {}) as DocumentMeta;
          const currentCategory = record.category;
          const belongUser = this.belongsToCurrentUser((record as any).uid ?? 0);
          const shouldMove = currentCategory === id || currentCategory === String(id) || Number(currentCategory) === id;
          if (shouldMove && belongUser) {
            cursor.update({
              ...record,
              category: reassignTo,
              uid: this.userId,
            });
          }
          cursor.continue();
        };
        request.onerror = (event) => reject(event);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async createDocument(meta: NewDocumentPayload, content: string): Promise<number> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("article_meta") || !db.objectStoreNames.contains("article_content")) {
      throw new Error("article stores not found");
    }
    // 先写元数据，再写正文内容，保持同一事务
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["article_meta", "article_content"], "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      let documentId: number | null = null;
      const payload: DocumentMeta = {
        ...meta,
        uid: meta.uid ?? this.userId,
      };
      const request = metaStore.add(payload);
      request.onsuccess = (event) => {
        documentId = (event.target as IDBRequest<number>).result;
        contentStore.put({
          document_id: documentId,
          content,
          uid: this.userId,
        });
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => {
        if (documentId == null) {
          reject(new Error("create document failed"));
        } else {
          resolve(documentId);
        }
      };
      transaction.onerror = (event) => reject(event);
    });
  }

  async getDocumentMeta(documentId: number): Promise<DocumentMeta | null> {
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_meta")) {
      return null;
    }
    // 只读获取元数据
    return new Promise((resolve) => {
      const transaction = db.transaction(["article_meta"], "readonly");
      const store = transaction.objectStore("article_meta");
      const request = store.get(documentId);
      request.onsuccess = () => {
        const meta = (request.result as DocumentMeta | undefined) || null;
        if (meta && this.belongsToCurrentUser((meta as any).uid ?? 0)) {
          resolve(meta);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  async updateDocumentMeta(documentId: number, updates: UpdateDocumentMetaInput): Promise<void> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("article_meta")) {
      return;
    }
    // 更新元数据，同时兼容旧的 `articles` 表字段
    return new Promise((resolve, reject) => {
      const stores: string[] = ["article_meta"];
      if (db.objectStoreNames.contains("articles")) {
        stores.push("articles");
      }
      const transaction = db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const metaReq = metaStore.get(documentId);
      metaReq.onsuccess = () => {
        const current = (metaReq.result || {document_id: documentId}) as DocumentMeta;
        const currentUid = (current as any).uid ?? this.userId;
        if (!this.belongsToCurrentUser(currentUid)) {
          resolve();
          return;
        }
        const payload: DocumentMeta = {
          ...current,
          ...updates,
          updatedAt: updates.updatedAt || new Date(),
          uid: updates.uid ?? currentUid ?? this.userId,
        };
        if (!payload.category) {
          payload.category = DEFAULT_CATEGORY_ID;
        }
        metaStore.put(payload);
        if (stores.includes("articles")) {
          const legacyStore = transaction.objectStore("articles");
          const legacyReq = legacyStore.get(documentId);
          legacyReq.onsuccess = () => {
            if (legacyReq.result) {
              legacyStore.put({
                ...legacyReq.result,
                name: updates.name || legacyReq.result.name,
              });
            }
          };
        }
      };
      metaReq.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  /**
   * 分页获取文档，按创建时间倒序。
   */
  async listDocumentsPage(offset: number, limit: number): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    const result = await this.readArticleMetaPage(db, offset, limit);
    if (result.items.length === 0 && db.objectStoreNames.contains("articles")) {
      await this.migrateLegacyArticles(db);
      return this.readArticleMetaPage(db, offset, limit);
    }
    return result;
  }

  /**
   * 获取全部文档，按创建时间倒序。
   */
  async listAllDocuments(): Promise<DocumentMeta[]> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    let items = await this.readAllArticleMeta(db);
    if (items.length === 0 && db.objectStoreNames.contains("articles")) {
      await this.migrateLegacyArticles(db);
      items = await this.readAllArticleMeta(db);
    }
    return items;
  }

  /**
   * 读取正文补齐字符数，并同步回元数据。
   */
  async ensureDocumentCharCount(meta: DocumentMeta): Promise<DocumentMeta> {
    if (!meta || meta.document_id == null || meta.charCount != null) {
      return meta;
    }
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_content") || !db.objectStoreNames.contains("article_meta")) {
      return meta;
    }
    return new Promise((resolve) => {
      const transaction = db.transaction(["article_content", "article_meta"], "readwrite");
      const contentStore = transaction.objectStore("article_content");
      const metaStore = transaction.objectStore("article_meta");
      const req = contentStore.get(meta.document_id);
      req.onsuccess = () => {
        const content = (req.result && (req.result as {content?: string}).content) || "";
        const charCount = countVisibleChars(content);
        const nextMeta = {...meta, charCount};
        metaStore.put(nextMeta);
        resolve(nextMeta);
      };
      req.onerror = () => resolve(meta);
    });
  }

  /**
   * 获取文档正文，若新表无数据则回退到旧表。
   */
  async getDocumentContent(documentId: number): Promise<string> {
    const db = await this.getDb();
    const stores = ["article_content"];
    if (db.objectStoreNames.contains("articles")) {
      stores.push("articles");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, "readonly");
      const contentStore = transaction.objectStore("article_content");
      const req = contentStore.get(documentId);
      req.onsuccess = () => {
        const found = req.result as {content?: string} | undefined;
        if (found && found.content != null) {
          resolve(found.content);
          return;
        }
        if (stores.includes("articles")) {
          const legacyStore = transaction.objectStore("articles");
          const legacyReq = legacyStore.get(documentId);
          legacyReq.onsuccess = () => resolve((legacyReq.result && legacyReq.result.content) || "");
          legacyReq.onerror = (event) => reject(event);
          return;
        }
        resolve("");
      };
      req.onerror = (event) => reject(event);
    });
  }

  /**
   * 删除文档元数据与正文，同时清理遗留表。
   */
  async deleteDocument(documentId: number): Promise<void> {
    const db = await this.getDb();
    const stores: string[] = ["article_meta", "article_content"];
    if (db.objectStoreNames.contains("articles")) {
      stores.push("articles");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      metaStore.delete(documentId);
      contentStore.delete(documentId);
      if (stores.includes("articles")) {
        transaction.objectStore("articles").delete(documentId);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  private async readAllArticleMeta(db: IDBDatabase): Promise<DocumentMeta[]> {
    if (!db.objectStoreNames.contains("article_meta")) {
      return [];
    }
    // 读取全部文章元数据，优先使用 createdAt 索引倒序
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["article_meta"], "readonly");
      const store = transaction.objectStore("article_meta");
      let request: IDBRequest<IDBCursorWithValue> | null = null;
      let useIndex = false;
      try {
        if (store.indexNames && store.indexNames.contains("createdAt")) {
          const index = store.index("createdAt");
          request = index.openCursor(null, "prev");
          useIndex = true;
        }
      } catch (_e) {
        useIndex = false;
      }
      if (!request) {
        request = store.openCursor();
      }
      const items: DocumentMeta[] = [];
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const value = cursor.value as DocumentMeta;
          if (this.belongsToCurrentUser((value as any).uid ?? 0)) {
            items.push(value);
          }
          cursor.continue();
        } else {
          if (!useIndex) {
            items.sort((a, b) => this.getTimeValue(b.createdAt) - this.getTimeValue(a.createdAt));
          }
          resolve(items);
        }
      };
      request.onerror = (event) => reject(event);
    });
  }

  private async readArticleMetaPage(
    db: IDBDatabase,
    offset: number,
    limit: number,
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    if (!db.objectStoreNames.contains("article_meta")) {
      return {items: [], hasMore: false};
    }
    // 分页读取文章元数据，优先使用 createdAt 索引
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["article_meta"], "readonly");
      const store = transaction.objectStore("article_meta");
      let request: IDBRequest<IDBCursorWithValue>;
      let useIndex = false;
      let done = false;

      const finish = (payload: {items: DocumentMeta[]; hasMore: boolean}) => {
        if (done) return;
        done = true;
        resolve(payload);
      };
      const fail = (event: Event) => {
        if (done) return;
        done = true;
        reject(event);
      };

      try {
        if (store.indexNames && store.indexNames.contains("createdAt")) {
          const index = store.index("createdAt");
          request = index.openCursor(null, "prev");
          useIndex = true;
        } else {
          request = store.openCursor();
        }
      } catch (_e) {
        request = store.openCursor();
      }

      if (!useIndex) {
        const all: DocumentMeta[] = [];
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (cursor) {
            const value = cursor.value as DocumentMeta;
            if (this.belongsToCurrentUser((value as any).uid ?? 0)) {
              all.push(value);
            }
            cursor.continue();
          } else {
            all.sort((a, b) => this.getTimeValue(b.createdAt) - this.getTimeValue(a.createdAt));
            const items = all.slice(offset, offset + limit);
            finish({items, hasMore: all.length > offset + limit});
          }
        };
        request.onerror = fail;
        return;
      }

      const items: DocumentMeta[] = [];
      let hasSkipped = offset === 0;
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          finish({items, hasMore: false});
          return;
        }
        if (!hasSkipped) {
          hasSkipped = true;
          cursor.advance(offset);
          return;
        }
        if (items.length < limit) {
          const value = cursor.value as DocumentMeta;
          if (this.belongsToCurrentUser((value as any).uid ?? 0)) {
            items.push(value);
          }
          cursor.continue();
          return;
        }
        finish({items, hasMore: true});
      };
      request.onerror = fail;
    });
  }

  /**
   * 将旧版 `articles` 表数据迁移到新结构（article_meta + article_content）。
   */
  private async migrateLegacyArticles(db: IDBDatabase): Promise<void> {
    if (!db.objectStoreNames.contains("articles")) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction(["articles", "article_meta", "article_content"], "readwrite");
      const legacyStore = transaction.objectStore("articles");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      const request = legacyStore.openCursor();
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const legacy = (cursor.value || {}) as Record<string, unknown>;
          const documentId = legacy.id as number;
          const content = (legacy.content as string) || "";
          const charCount =
            legacy.charCount != null && Number.isFinite(Number(legacy.charCount))
              ? Number(legacy.charCount)
              : countVisibleChars(content as string);
          const createdAt =
            legacy.createdAt != null
              ? new Date(legacy.createdAt as string | number | Date)
              : legacy.updatedAt != null
                ? new Date(legacy.updatedAt as string | number | Date)
                : new Date();
          const updatedAt =
            legacy.updatedAt != null
              ? new Date(legacy.updatedAt as string | number | Date)
              : createdAt;
          const meta: DocumentMeta = {
            document_id: documentId,
            name: (legacy.name as string) || "未命名.md",
            charCount,
            category: DEFAULT_CATEGORY_ID,
            createdAt,
            updatedAt,
            uid: this.userId,
          };
          metaStore.put(meta);
          contentStore.put({
            document_id: documentId,
            content,
            uid: this.userId,
          });
          cursor.continue();
        }
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async getConfig<T = unknown>(key: string, fallback?: T): Promise<T | null> {
    const storage = this.getConfigStorage();
    const raw = storage ? storage.getItem(key) : this.configFallback.get(key);
    if (raw == null) {
      return fallback ?? null;
    }
    try {
      return JSON.parse(raw) as T;
    } catch (_e) {
      // 非 JSON 字符串，直接返回
      return (raw as unknown) as T;
    }
  }

  async setConfig<T = unknown>(key: string, value: T): Promise<void> {
    const payload = typeof value === "string" ? value : JSON.stringify(value);
    const storage = this.getConfigStorage();
    if (storage) {
      storage.setItem(key, payload);
    } else {
      this.configFallback.set(key, payload);
    }
  }

  async removeConfig(key: string): Promise<void> {
    const storage = this.getConfigStorage();
    if (storage) {
      storage.removeItem(key);
    }
    this.configFallback.delete(key);
  }

  async listConfigKeys(prefix?: string): Promise<string[]> {
    const storage = this.getConfigStorage();
    const keys: string[] = [];
    if (storage) {
      for (let i = 0; i < storage.length; i += 1) {
        const k = storage.key(i);
        if (k && (!prefix || k.startsWith(prefix))) {
          keys.push(k);
        }
      }
    } else {
      this.configFallback.forEach((_v, k) => {
        if (!prefix || k.startsWith(prefix)) {
          keys.push(k);
        }
      });
    }
    return keys;
  }
}
