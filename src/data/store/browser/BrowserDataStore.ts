import IndexDB from "../../../component/LocalHistory/indexdb";
import {countVisibleChars} from "../../../utils/helper";
import {DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_ID} from "../../../utils/constant";
import {
  Category,
  CategoryWithCount,
  DocumentMeta,
  NewDocumentPayload,
  SourceType,
  UpdateDocumentMetaInput,
} from "../types";
import {IDataStore} from "../IDataStore";

type CategoriesByUuid = Map<string, Category>;
type CategoriesByName = Map<string, string>;
type CategoriesByLegacyId = Map<number, string>;

export class BrowserDataStore implements IDataStore {
  private readonly userId: number;
  private readonly defaultSource: SourceType;

  constructor(userId = 0) {
    this.userId = Number.isFinite(userId) ? Number(userId) : 0;
    this.defaultSource = this.userId > 0 ? "remote" : "local";
  }

  // 持有单例的 IDB 连接
  private db: IDBDatabase | null = null;

  // 避免重复初始化的 promise
  private initPromise: Promise<IDBDatabase> | null = null;

  // 避免重复数据迁移
  private backfillPromise: Promise<void> | null = null;

  // 配置存储的内存兜底（非浏览器环境或 localStorage 不可用时）
  private configFallback = new Map<string, string>();

  private generateUuid(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID().replace(/-/g, "");
    }
    const bytes = new Uint8Array(16);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      crypto.getRandomValues(bytes);
    } else {
      for (let i = 0; i < bytes.length; i += 1) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  private normalizeUuid(value: unknown, fallback?: string): string {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed.replace(/-/g, "");
      }
    }
    if (typeof fallback === "string" && fallback.trim()) {
      return fallback.trim().replace(/-/g, "");
    }
    return "";
  }

  private normalizeSource(source?: string | null): SourceType {
    return source === "remote" || source === "local" ? source : this.defaultSource;
  }

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
        version: 6,
        storeName: "article_meta",
        storeOptions: {keyPath: "document_id", autoIncrement: false},
        storeInit: (objectStore, db, transaction) => {
          // 文章元数据索引：名称/创建时间/更新时间/目录
          if (objectStore && !objectStore.indexNames.contains("name")) {
            objectStore.createIndex("name", "name", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("document_id")) {
            objectStore.createIndex("document_id", "document_id", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("uid")) {
            objectStore.createIndex("uid", "uid", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("source")) {
            objectStore.createIndex("source", "source", {unique: false});
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
          if (objectStore && !objectStore.indexNames.contains("category_id")) {
            objectStore.createIndex("category_id", "category_id", {unique: false});
          }
          // 文章正文存储
          if (db && !db.objectStoreNames.contains("article_content")) {
            const contentStore = db.createObjectStore("article_content", {keyPath: "document_id"});
            contentStore.createIndex("uid", "uid", {unique: false});
            contentStore.createIndex("document_id", "document_id", {unique: false});
            contentStore.createIndex("source", "source", {unique: false});
          } else if (transaction && transaction.objectStoreNames.contains("article_content")) {
            const contentStore = transaction.objectStore("article_content");
            if (contentStore && !contentStore.indexNames.contains("uid")) {
              contentStore.createIndex("uid", "uid", {unique: false});
            }
            if (contentStore && !contentStore.indexNames.contains("document_id")) {
              contentStore.createIndex("document_id", "document_id", {unique: false});
            }
            if (contentStore && !contentStore.indexNames.contains("source")) {
              contentStore.createIndex("source", "source", {unique: false});
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
            if (categoriesStore && !categoriesStore.indexNames.contains("category_id")) {
              categoriesStore.createIndex("category_id", "category_id", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("source")) {
              categoriesStore.createIndex("source", "source", {unique: false});
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
                category_id: DEFAULT_CATEGORY_UUID,
                name: DEFAULT_CATEGORY_NAME,
                createdAt: now,
                updatedAt: now,
                uid: this.userId,
                source: this.defaultSource,
                version: 1,
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
    await this.ensureBackfill(this.db);
    return this.db;
  }

  private async ensureBackfill(db: IDBDatabase): Promise<void> {
    if (!this.backfillPromise) {
      this.backfillPromise = this.backfillDb(db);
    }
    await this.backfillPromise;
  }

  private async backfillDb(db: IDBDatabase): Promise<void> {
    if (!db.objectStoreNames.contains("categories") || !db.objectStoreNames.contains("article_meta")) {
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const stores = ["categories", "article_meta"];
      if (db.objectStoreNames.contains("article_content")) {
        stores.push("article_content");
      }
      const tx = db.transaction(stores, "readwrite");
      const categoriesStore = tx.objectStore("categories");
      const metaStore = tx.objectStore("article_meta");
      const contentStore = stores.includes("article_content") ? tx.objectStore("article_content") : null;

      const categoriesById: CategoriesByLegacyId = new Map();
      const categoriesByName: CategoriesByName = new Map();
      const categoriesByUuid: CategoriesByUuid = new Map();
      const docIdByLegacyId = new Map<number, string>();

      const normalizeRecordSource = (record: any): SourceType => {
        const raw = record?.source;
        if (raw === "remote" || raw === "local") return raw;
        const uid = this.normalizeUid(record?.uid);
        return uid > 0 ? "remote" : "local";
      };
      const normalizeRecordUid = (record: any): number => this.normalizeUid(record?.uid);
      const parseLegacy = (value: unknown): number | null => {
        if (typeof value === "number" && Number.isFinite(value)) return value;
        if (typeof value === "string") return this.parseLegacyId(value);
        return null;
      };
      const resolveCategoryId = (value: any): string => {
        const normalized = this.normalizeUuid(value);
        if (normalized) return normalized;
        if (typeof value === "number" && categoriesById.has(value)) {
          return categoriesById.get(value) as string;
        }
        if (typeof value === "string" && categoriesByName.has(value)) {
          return categoriesByName.get(value) as string;
        }
        const legacyId = parseLegacy(value);
        if (legacyId != null && categoriesById.has(legacyId)) {
          return categoriesById.get(legacyId) as string;
        }
        return DEFAULT_CATEGORY_UUID;
      };

      const runContentCursor = () => {
        if (!contentStore) {
          return;
        }
        const contentCursor = contentStore.openCursor();
        contentCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            return;
          }
          const value = cursor.value as any;
          const rawKey = value.document_id ?? value.document_uuid;
          const legacyNumeric = parseLegacy(rawKey);
          let documentId = typeof rawKey === "string" ? this.normalizeUuid(rawKey) : "";
          if (!documentId) {
            const legacyUuid = this.normalizeUuid(value.document_uuid);
            if (legacyUuid) documentId = legacyUuid;
          }
          if (!documentId && legacyNumeric != null && docIdByLegacyId.has(legacyNumeric)) {
            documentId = docIdByLegacyId.get(legacyNumeric) as string;
          }
          if (!documentId) {
            cursor.continue();
            return;
          }
          const nextSource = normalizeRecordSource(value);
          const nextUid = normalizeRecordUid(value);
          const nextValue = {
            ...value,
            document_id: documentId,
            uid: nextUid,
            source: nextSource,
          };
          const keyNeedsChange = rawKey !== documentId;
          if (keyNeedsChange) {
            contentStore.put(nextValue);
            cursor.delete();
          } else {
            const changed = nextSource !== value.source || nextUid !== value.uid || value.document_id !== documentId;
            if (changed) cursor.update(nextValue);
          }
          cursor.continue();
        };
      };

      const runMetaCursor = () => {
        const metaCursor = metaStore.openCursor();
        metaCursor.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            runContentCursor();
            return;
          }
          const value = cursor.value as any;
          const rawKey = value.document_id ?? value.document_uuid;
          const legacyNumeric = parseLegacy(rawKey);
          let documentId = typeof rawKey === "string" ? this.normalizeUuid(rawKey) : "";
          if (!documentId) {
            const legacyUuid = this.normalizeUuid(value.document_uuid);
            if (legacyUuid) documentId = legacyUuid;
          }
          if (!documentId && legacyNumeric != null && docIdByLegacyId.has(legacyNumeric)) {
            documentId = docIdByLegacyId.get(legacyNumeric) as string;
          }
          if (!documentId) {
            documentId = this.generateUuid();
          }
          if (legacyNumeric != null && !docIdByLegacyId.has(legacyNumeric)) {
            docIdByLegacyId.set(legacyNumeric, documentId);
          }
          const categoryId =
            this.normalizeUuid(value.category_id) ||
            this.normalizeUuid(value.category_uuid) ||
            resolveCategoryId(value.category);
          const nextSource = normalizeRecordSource(value);
          const nextUid = normalizeRecordUid(value);
          const nextVersion = value.version ?? 1;
          const nextValue = {
            ...value,
            document_id: documentId,
            category_id: categoryId || DEFAULT_CATEGORY_UUID,
            uid: nextUid,
            source: nextSource,
            version: nextVersion,
          };
          const keyNeedsChange = rawKey !== documentId;
          if (keyNeedsChange) {
            metaStore.put(nextValue);
            cursor.delete();
          } else {
            const changed =
              value.document_id !== documentId ||
              value.category_id !== nextValue.category_id ||
              value.uid !== nextUid ||
              value.source !== nextSource ||
              value.version !== nextVersion;
            if (changed) cursor.update(nextValue);
          }
          cursor.continue();
        };
      };

      const categoryCursor = categoriesStore.openCursor();
      categoryCursor.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          runMetaCursor();
          return;
        }
        const value = cursor.value as any;
        const nextSource = normalizeRecordSource(value);
        const nextUid = normalizeRecordUid(value);
        const nextVersion = value.version ?? 1;
        let categoryId = this.normalizeUuid(value.category_id);
        if (!categoryId) {
          const legacy = this.normalizeUuid(value.category_uuid);
          categoryId =
            legacy ||
            (value.id === DEFAULT_CATEGORY_ID || value.id === DEFAULT_CATEGORY_UUID
              ? DEFAULT_CATEGORY_UUID
              : this.generateUuid());
        }
        const nextValue = {
          ...value,
          category_id: categoryId,
          uid: nextUid,
          source: nextSource,
          version: nextVersion,
        };
        const changed =
          value.category_id !== categoryId ||
          value.uid !== nextUid ||
          value.source !== nextSource ||
          value.version !== nextVersion;
        if (changed) {
          cursor.update(nextValue);
        }
        if (categoryId) {
          categoriesByUuid.set(String(categoryId), {...nextValue, category_id: categoryId});
          if (value.name) categoriesByName.set(value.name, String(categoryId));
          if (typeof value.id === "number") categoriesById.set(value.id, String(categoryId));
        }
        cursor.continue();
      };

      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
    });
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
      let request: IDBRequest<any>;
      try {
        const index = store.index("category_id");
        request = index.get(DEFAULT_CATEGORY_UUID);
      } catch (_e) {
        request = store.get(DEFAULT_CATEGORY_ID);
      }
      request.onsuccess = () => {
        const current = (request.result || null) as Category | null;
        if (current) {
          const nextSource = this.normalizeSource((current as any).source);
          const nextUuid =
            this.normalizeUuid((current as any).category_id) || DEFAULT_CATEGORY_UUID;
          const nextVersion = (current as any).version ?? 1;
          if (!current.uid || (current as any).source !== nextSource || (current as any).category_id !== nextUuid) {
            store.put({
              ...current,
              uid: this.userId,
              category_id: nextUuid,
              source: nextSource,
              version: nextVersion,
            });
          }
          resolve(current);
          return;
        }
        const now = new Date();
        const payload: Category = {
          id: DEFAULT_CATEGORY_ID,
          category_id: DEFAULT_CATEGORY_UUID,
          name: DEFAULT_CATEGORY_NAME,
          createdAt: now,
          updatedAt: now,
          uid: this.userId,
          source: this.defaultSource,
          version: 1,
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

  private matchesScope(record: {uid?: unknown; source?: string | null}): boolean {
    if (!this.belongsToCurrentUser(record.uid)) return false;
    const source = this.normalizeSource(record.source);
    return source === this.defaultSource;
  }

  private parseLegacyId(value: string): number | null {
    if (!value) return null;
    if (!/^\d+$/.test(value) || value.length > 12) return null;
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  private ensureIdKey(store: IDBObjectStore, payload: Record<string, any>, fallbackId: number) {
    const keyPath = store.keyPath;
    if (keyPath === "id" && !store.autoIncrement && (payload.id == null || payload.id === "")) {
      payload.id = fallbackId;
    }
  }

  private sortCategories(categories: Category[]): Category[] {
    // 默认目录永远排在最前，其余按创建时间升序
    return categories.slice().sort((a, b) => {
      const aIsDefault =
        (a as any).category_id === DEFAULT_CATEGORY_UUID || a.id === DEFAULT_CATEGORY_ID || a.id === DEFAULT_CATEGORY_UUID;
      const bIsDefault =
        (b as any).category_id === DEFAULT_CATEGORY_UUID || b.id === DEFAULT_CATEGORY_ID || b.id === DEFAULT_CATEGORY_UUID;
      if (aIsDefault) return -1;
      if (bIsDefault) return 1;
      return this.getTimeValue(a.createdAt) - this.getTimeValue(b.createdAt);
    });
  }

  private normalizeCategory(
    value: unknown,
    categoriesById: CategoriesByLegacyId,
    categoriesByUuid: CategoriesByUuid,
    categoriesByName: CategoriesByName,
  ): string {
    // 兼容数字或字符串的旧数据，将目录归一化到合法 UUID
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      const normalized = this.normalizeUuid(trimmed);
      if (normalized && categoriesByUuid.has(normalized)) {
        return normalized;
      }
      if (categoriesByUuid.has(trimmed)) {
        return trimmed;
      }
      if (categoriesByName.has(trimmed)) {
        return categoriesByName.get(trimmed) as string;
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && categoriesById.has(parsed)) {
        return categoriesById.get(parsed) as string;
      }
    }
    if (typeof value === "number" && categoriesById.has(value)) {
      return categoriesById.get(value) as string;
    }
    return DEFAULT_CATEGORY_UUID;
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
          if (this.matchesScope(value as any)) {
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

  private async collectCategoryCounts(categories: Category[]): Promise<Map<string, number>> {
    const db = await this.getDb();
    const counts = new Map<string, number>();
    if (!db.objectStoreNames.contains("article_meta")) {
      return counts;
    }
    // 构建目录索引方便归一化
    const categoriesById: CategoriesByLegacyId = new Map();
    const categoriesByUuid: CategoriesByUuid = new Map();
    const categoriesByName: CategoriesByName = new Map();
    categories.forEach((category) => {
      categoriesByUuid.set(category.category_id, category);
      if (typeof category.id === "number") {
        categoriesById.set(category.id, category.category_id);
      }
      if (category.name) {
        categoriesByName.set(category.name, category.category_id);
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
        if (!this.matchesScope(record as any)) {
          cursor.continue();
          return;
        }
        const nextCategoryUuid = this.normalizeCategory(
          (record as any).category_id ?? (record as any).category,
          categoriesById,
          categoriesByUuid,
          categoriesByName,
        );
        if ((record as any).category_id !== nextCategoryUuid) {
          cursor.update({...record, category_id: nextCategoryUuid});
        }
        counts.set(nextCategoryUuid, (counts.get(nextCategoryUuid) || 0) + 1);
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
      count: counts.get(category.category_id) || 0,
    }));
  }

  async createCategory(
    name: string,
    options?: {category_id?: string; source?: SourceType; version?: number},
  ): Promise<Category> {
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
      const categoryUuid = this.normalizeUuid(options?.category_id) || this.generateUuid();
      const source = options?.source || this.defaultSource;
      const version = options?.version ?? 1;
      const payload: Category = {
        name,
        category_id: categoryUuid,
        createdAt: now,
        updatedAt: now,
        uid: this.userId,
        source,
        version,
      };
      this.ensureIdKey(store, payload as any, Date.now());
      const request = store.add(payload);
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
            category_id: categoryUuid,
            name,
            createdAt: now,
            updatedAt: now,
            uid: this.userId,
            source,
            version,
          });
        }
      };
      transaction.onerror = (event) => reject(event);
    });
  }

  async renameCategory(categoryUuid: string, name: string): Promise<void> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      return;
    }
    const normalizedCategory = this.normalizeUuid(categoryUuid) || categoryUuid;
    // 更新目录名称与更新时间
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["categories"], "readwrite");
      const store = transaction.objectStore("categories");
      const index = store.index("category_id");
      const request = index.get(normalizedCategory);
      request.onsuccess = () => {
        let current = (request.result || null) as Category | null;
        if (!current) {
          const fallbackId = this.parseLegacyId(normalizedCategory);
          if (fallbackId != null) {
            const fallbackReq = store.get(fallbackId);
            fallbackReq.onsuccess = () => {
              current = (fallbackReq.result || null) as Category | null;
              if (!current) {
                resolve();
                return;
              }
              if (!this.matchesScope(current as any)) {
                resolve();
                return;
              }
              store.put({
                ...current,
                name,
                updatedAt: new Date(),
                version: ((current as any).version ?? 1) + 1,
              });
            };
            fallbackReq.onerror = () => resolve();
            return;
          }
        }
        if (!current) {
          resolve();
          return;
        }
        if (!this.matchesScope(current as any)) {
          resolve();
          return;
        }
        store.put({
          ...current,
          name,
          updatedAt: new Date(),
          version: ((current as any).version ?? 1) + 1,
        });
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  async deleteCategory(categoryUuid: string, options?: {reassignTo?: string}): Promise<void> {
    const db = await this.getDb();
    const normalizedCategory = this.normalizeUuid(categoryUuid) || categoryUuid;
    const reassignTo = this.normalizeUuid(options?.reassignTo) || DEFAULT_CATEGORY_UUID;
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("categories")) {
      return;
    }
    const owned = await new Promise<Category | null>((resolve, reject) => {
      const tx = db.transaction(["categories"], "readonly");
      const store = tx.objectStore("categories");
      const index = store.index("category_id");
      const req = index.get(normalizedCategory);
      req.onsuccess = () => {
        let result = (req.result || null) as Category | null;
        if (!result) {
          const fallbackId = this.parseLegacyId(normalizedCategory);
          if (fallbackId != null) {
            const fallbackReq = store.get(fallbackId);
            fallbackReq.onsuccess = () => {
              result = (fallbackReq.result || null) as Category | null;
              if (result && !this.matchesScope(result as any)) {
                resolve(null);
                return;
              }
              resolve(result);
            };
            fallbackReq.onerror = () => reject(new Error("get category failed"));
            return;
          }
        }
        if (result && !this.matchesScope(result as any)) {
          resolve(null);
          return;
        }
        resolve(result);
      };
      req.onerror = (event) => reject(event);
    });
    if (!owned) return;
    if ((owned as any).category_id === DEFAULT_CATEGORY_UUID) return;
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
      categoryStore.delete(owned.id);
      if (stores.includes("article_meta")) {
        const metaStore = transaction.objectStore("article_meta");
        const request = metaStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) {
            return;
          }
          const record = (cursor.value || {}) as DocumentMeta;
          const currentCategory = (record as any).category_id ?? (record as any).category;
          const belongUser = this.matchesScope(record as any);
          const shouldMove = currentCategory === normalizedCategory;
          if (shouldMove && belongUser) {
            cursor.update({
              ...record,
              category_id: reassignTo,
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

  async createDocument(meta: NewDocumentPayload, content: string): Promise<DocumentMeta> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("article_meta")) {
      throw new Error("article_meta store not found");
    }
    return new Promise((resolve, reject) => {
      const stores = ["article_meta"];
      if (db.objectStoreNames.contains("article_content")) {
        stores.push("article_content");
      }
      const transaction = db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = stores.includes("article_content") ? transaction.objectStore("article_content") : null;
      const documentId = this.normalizeUuid(meta.document_id) || this.generateUuid();
      const normalizedCategoryId = this.normalizeUuid(meta.category_id) || DEFAULT_CATEGORY_UUID;
      const source = meta.source || this.defaultSource;
      const version = meta.version ?? 1;
      const payload: DocumentMeta = {
        ...meta,
        document_id: documentId,
        category_id: normalizedCategoryId,
        uid: meta.uid ?? this.userId,
        source,
        version,
      };
      this.ensureIdKey(metaStore, payload as any, Date.now());
      const index = metaStore.index("document_id");
      const lookup = index.get(documentId);
      lookup.onsuccess = () => {
        const existing = lookup.result as DocumentMeta | undefined;
        if (existing) {
          const existingVersion = (existing as any).version ?? 1;
          if (version > existingVersion) {
            metaStore.put({
              ...existing,
              ...payload,
              document_id: documentId,
              updatedAt: meta.updatedAt || new Date(),
            });
            if (contentStore) {
              contentStore.put({
                document_id: documentId,
                content,
                uid: this.userId,
                source,
              });
            }
          }
          resolve({
            ...existing,
            ...payload,
            document_id: documentId,
          });
          return;
        }
        metaStore.put(payload);
        if (contentStore) {
          contentStore.put({
            document_id: documentId,
            content,
            uid: this.userId,
            source,
          });
        }
        resolve(payload);
      };
      lookup.onerror = (event) => reject(event);
      transaction.onerror = (event) => reject(event);
    });
  }

  async getDocumentMeta(documentUuid: string): Promise<DocumentMeta | null> {
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_meta")) {
      return null;
    }
    const normalizedDocumentId = this.normalizeUuid(documentUuid) || documentUuid;
    // 只读获取元数据
    return new Promise((resolve) => {
      const transaction = db.transaction(["article_meta"], "readonly");
      const store = transaction.objectStore("article_meta");
      const index = store.index("document_id");
      const request = index.get(normalizedDocumentId);
      request.onsuccess = () => {
        let meta = (request.result as DocumentMeta | undefined) || null;
        if (!meta) {
          const fallbackId = this.parseLegacyId(normalizedDocumentId);
          if (fallbackId != null) {
            const fallbackReq = store.get(fallbackId);
            fallbackReq.onsuccess = () => {
              meta = (fallbackReq.result as DocumentMeta | undefined) || null;
              if (meta && this.matchesScope(meta as any)) {
                resolve(meta);
              } else {
                resolve(null);
              }
            };
            fallbackReq.onerror = () => resolve(null);
            return;
          }
        }
        if (meta && this.matchesScope(meta as any)) {
          resolve(meta);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  async updateDocumentMeta(documentUuid: string, updates: UpdateDocumentMetaInput): Promise<void> {
    const db = await this.getDb();
    await this.ensureDefaultCategory(db);
    if (!db.objectStoreNames.contains("article_meta")) {
      return;
    }
    const normalizedDocumentId = this.normalizeUuid(documentUuid) || documentUuid;
    // 更新元数据，同时兼容旧的 `articles` 表字段
    return new Promise((resolve, reject) => {
      const stores: string[] = ["article_meta"];
      if (db.objectStoreNames.contains("articles")) {
        stores.push("articles");
      }
      const transaction = db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const index = metaStore.index("document_id");
      const metaReq = index.get(normalizedDocumentId);
      metaReq.onsuccess = () => {
        let current = (metaReq.result || null) as DocumentMeta | null;
        if (!current) {
          const fallbackId = this.parseLegacyId(normalizedDocumentId);
          if (fallbackId != null) {
            const fallbackReq = metaStore.get(fallbackId);
            fallbackReq.onsuccess = () => {
              current = (fallbackReq.result || null) as DocumentMeta | null;
              if (!current || !this.matchesScope(current as any)) {
                resolve();
                return;
              }
              const currentUid = (current as any).uid ?? this.userId;
              const payload: DocumentMeta = {
                ...current,
                ...updates,
                updatedAt: updates.updatedAt || new Date(),
                uid: updates.uid ?? currentUid ?? this.userId,
                source: updates.source ?? (current as any).source ?? this.defaultSource,
                version: updates.version ?? ((current as any).version ?? 1) + 1,
              };
              if (!(payload as any).category_id) {
                (payload as any).category_id = DEFAULT_CATEGORY_UUID;
              } else {
                (payload as any).category_id =
                  this.normalizeUuid((payload as any).category_id) || DEFAULT_CATEGORY_UUID;
              }
              metaStore.put(payload);
              if (stores.includes("articles")) {
                const legacyStore = transaction.objectStore("articles");
                const legacyReq = legacyStore.get((current as any).id ?? (current as any).document_id);
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
            fallbackReq.onerror = () => resolve();
            return;
          }
        }
        const currentUid = (current as any)?.uid ?? this.userId;
        if (!current || !this.matchesScope(current as any)) {
          resolve();
          return;
        }
        const payload: DocumentMeta = {
          ...current,
          ...updates,
          updatedAt: updates.updatedAt || new Date(),
          uid: updates.uid ?? currentUid ?? this.userId,
          source: updates.source ?? (current as any).source ?? this.defaultSource,
          version: updates.version ?? ((current as any).version ?? 1) + 1,
        };
        if (!(payload as any).category_id) {
          (payload as any).category_id = DEFAULT_CATEGORY_UUID;
        } else {
          (payload as any).category_id =
            this.normalizeUuid((payload as any).category_id) || DEFAULT_CATEGORY_UUID;
        }
        metaStore.put(payload);
        if (stores.includes("articles")) {
          const legacyStore = transaction.objectStore("articles");
          const legacyReq = legacyStore.get((current as any).id ?? (current as any).document_id);
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
    if (!meta || !meta.document_id || meta.charCount != null) {
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
      const index = contentStore.index("document_id");
      const req = index.get(meta.document_id);
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
  async getDocumentContent(documentUuid: string): Promise<string> {
    const db = await this.getDb();
    const normalizedDocumentId = this.normalizeUuid(documentUuid) || documentUuid;
    const stores = ["article_content"];
    if (db.objectStoreNames.contains("articles")) {
      stores.push("articles");
    }
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, "readonly");
      const contentStore = transaction.objectStore("article_content");
      const index = contentStore.index("document_id");
      const req = index.get(normalizedDocumentId);
      req.onsuccess = () => {
        const found = req.result as {content?: string} | undefined;
        if (found && found.content != null) {
          resolve(found.content);
          return;
        }
        const fallbackId = this.parseLegacyId(normalizedDocumentId);
        if (fallbackId != null) {
          const fallbackReq = contentStore.get(fallbackId);
          fallbackReq.onsuccess = () => {
            const fallbackFound = fallbackReq.result as {content?: string} | undefined;
            if (fallbackFound && fallbackFound.content != null) {
              resolve(fallbackFound.content);
              return;
            }
            if (stores.includes("articles")) {
              const legacyStore = transaction.objectStore("articles");
              const legacyReq = legacyStore.get(fallbackId);
              legacyReq.onsuccess = () => resolve((legacyReq.result && legacyReq.result.content) || "");
              legacyReq.onerror = (event) => reject(event);
              return;
            }
            resolve("");
          };
          fallbackReq.onerror = () => resolve("");
          return;
        }
        if (stores.includes("articles")) {
          const legacyStore = transaction.objectStore("articles");
          const legacyReq = legacyStore.get(normalizedDocumentId);
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
   * 保存最新正文到本地（不保留历史版本）。
   */
  async saveDocumentContent(documentId: string, content: string, updatedAt?: TimestampValue): Promise<void> {
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_content") || !db.objectStoreNames.contains("article_meta")) {
      return;
    }
    const normalizedDocumentId = this.normalizeUuid(documentId) || documentId;
    const nextUpdatedAt = updatedAt ?? new Date();
    const charCount = countVisibleChars(content);
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(["article_content", "article_meta"], "readwrite");
      const contentStore = transaction.objectStore("article_content");
      const metaStore = transaction.objectStore("article_meta");
      const metaIndex = metaStore.index("document_id");
      const metaReq = metaIndex.get(normalizedDocumentId);
      metaReq.onsuccess = () => {
        let current = (metaReq.result || null) as DocumentMeta | null;
        if (!current) {
          const fallbackId = this.parseLegacyId(normalizedDocumentId);
          if (fallbackId != null) {
            const fallbackReq = metaStore.get(fallbackId);
            fallbackReq.onsuccess = () => {
              current = (fallbackReq.result || null) as DocumentMeta | null;
              if (!current || !this.matchesScope(current as any)) {
                resolve();
                return;
              }
              const resolvedId = (current as any).document_id || normalizedDocumentId;
              if (resolvedId != null) {
                contentStore.put({
                  document_id: resolvedId,
                  content,
                  uid: this.userId,
                  source: (current as any).source ?? this.defaultSource,
                });
              }
              metaStore.put({
                ...current,
                updatedAt: nextUpdatedAt,
                charCount,
                uid: (current as any).uid ?? this.userId,
                version: ((current as any).version ?? 1) + 1,
              });
            };
            fallbackReq.onerror = () => resolve();
            return;
          }
        }
        if (!current || !this.matchesScope(current as any)) {
          resolve();
          return;
        }
        const resolvedId = (current as any).document_id || normalizedDocumentId;
        if (resolvedId != null) {
          contentStore.put({
            document_id: resolvedId,
            content,
            uid: this.userId,
            source: (current as any).source ?? this.defaultSource,
          });
        }
        metaStore.put({
          ...current,
          updatedAt: nextUpdatedAt,
          charCount,
          uid: (current as any).uid ?? this.userId,
          version: ((current as any).version ?? 1) + 1,
        });
      };
      metaReq.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  /**
   * 删除文档元数据与正文，同时清理遗留表。
   */
  async deleteDocument(documentUuid: string): Promise<void> {
    const db = await this.getDb();
    const stores: string[] = ["article_meta", "article_content"];
    if (db.objectStoreNames.contains("articles")) {
      stores.push("articles");
    }
    const normalizedDocumentId = this.normalizeUuid(documentUuid) || documentUuid;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      const metaIndex = metaStore.index("document_id");
      const metaReq = metaIndex.get(normalizedDocumentId);
      metaReq.onsuccess = () => {
        let current = metaReq.result as DocumentMeta | undefined;
        if (!current) {
          const fallbackId = this.parseLegacyId(normalizedDocumentId);
          if (fallbackId != null) {
            const fallbackReq = metaStore.get(fallbackId);
            fallbackReq.onsuccess = () => {
              current = fallbackReq.result as DocumentMeta | undefined;
              if (current && this.matchesScope(current as any)) {
                const docId = (current as any).document_id;
                if (docId != null) {
                  metaStore.delete(docId);
                  contentStore.delete(docId);
                }
              }
            };
            return;
          }
        }
        if (current && this.matchesScope(current as any)) {
          const docId = (current as any).document_id;
          if (docId != null) {
            metaStore.delete(docId);
            contentStore.delete(docId);
          }
        }
      };
      if (stores.includes("articles")) {
        transaction.objectStore("articles").delete(normalizedDocumentId);
      }
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
  }

  // --- Remote cache helpers (not part of IDataStore) ---
  async upsertCategorySnapshot(category: Category): Promise<Category> {
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("categories")) {
      return category;
    }
    return new Promise((resolve, reject) => {
      const tx = db.transaction(["categories"], "readwrite");
      const store = tx.objectStore("categories");
      const index = store.index("category_id");
      const categoryUuid = this.normalizeUuid(category.category_id) || this.generateUuid();
      const expectedSource = this.normalizeSource((category as any).source);
      const expectedUid = this.userId;
      const req = index.openCursor(IDBKeyRange.only(categoryUuid));
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          const payload: Category = {
            ...category,
            category_id: categoryUuid,
            uid: expectedUid,
            source: expectedSource,
            version: (category as any).version ?? 1,
          };
          const addPayload: Category = {...payload};
          if (store.keyPath === "id" && store.autoIncrement) {
            delete (addPayload as any).id;
          } else {
            this.ensureIdKey(store, addPayload as any, Number(category.id) || Date.now());
          }
          const addReq = store.add(addPayload);
          addReq.onsuccess = (addEvent) => {
            const id = (addEvent.target as IDBRequest<number>).result;
            resolve({...payload, id});
          };
          addReq.onerror = (addEvent) => reject(addEvent);
          return;
        }
        const existing = cursor.value as Category;
        const existingUid = this.normalizeUid((existing as any).uid);
        const existingSource = this.normalizeSource((existing as any).source);
        if (existingUid !== expectedUid || existingSource !== expectedSource) {
          cursor.continue();
          return;
        }
        const payload: Category = {
          ...existing,
          ...category,
          category_id: categoryUuid,
          uid: expectedUid,
          source: expectedSource,
          version: (category as any).version ?? (existing as any)?.version ?? 1,
        };
        store.put({...payload, id: (existing as any).id});
        resolve({...payload, id: (existing as any).id});
      };
      req.onerror = (event) => reject(event);
    });
  }

  async upsertDocumentSnapshot(meta: DocumentMeta, content?: string): Promise<DocumentMeta> {
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_meta")) {
      return meta;
    }
    return new Promise((resolve, reject) => {
      const stores = ["article_meta"];
      if (db.objectStoreNames.contains("article_content")) {
        stores.push("article_content");
      }
      const tx = db.transaction(stores, "readwrite");
      const metaStore = tx.objectStore("article_meta");
      const contentStore = stores.includes("article_content") ? tx.objectStore("article_content") : null;
      const documentId = this.normalizeUuid(meta.document_id) || this.generateUuid();
      const index = metaStore.index("document_id");
      const expectedSource = this.normalizeSource((meta as any).source);
      const expectedUid = this.userId;
      const incomingVersion = (meta as any).version ?? 1;
      const normalizedCategoryId = this.normalizeUuid(meta.category_id) || DEFAULT_CATEGORY_UUID;
      const req = index.openCursor(IDBKeyRange.only(documentId));
      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) {
          const payload: DocumentMeta = {
            ...meta,
            document_id: documentId,
            category_id: normalizedCategoryId,
            uid: expectedUid,
            source: expectedSource,
            version: incomingVersion,
          };
          this.ensureIdKey(metaStore, payload as any, Number((meta as any).id) || Date.now());
          metaStore.put(payload);
          if (contentStore && typeof content === "string") {
            contentStore.put({
              document_id: documentId,
              content,
              uid: expectedUid,
              source: expectedSource,
            });
          }
          resolve(payload);
          return;
        }
        const existing = cursor.value as DocumentMeta;
        const existingUid = this.normalizeUid((existing as any).uid);
        const existingSource = this.normalizeSource((existing as any).source);
        if (existingUid !== expectedUid || existingSource !== expectedSource) {
          cursor.continue();
          return;
        }
        const existingVersion = (existing as any).version ?? 1;
        const resolvedIncomingVersion = (meta as any).version == null ? existingVersion : incomingVersion;
        if (existingVersion > resolvedIncomingVersion) {
          resolve(existing);
          return;
        }
        const payload: DocumentMeta = {
          ...existing,
          ...meta,
          document_id: documentId,
          category_id:
            this.normalizeUuid(meta.category_id) ||
            (existing as any)?.category_id ||
            DEFAULT_CATEGORY_UUID,
          uid: expectedUid,
          source: expectedSource,
          version: resolvedIncomingVersion,
        };
        metaStore.put(payload);
        if (contentStore && typeof content === "string") {
          contentStore.put({
            document_id: documentId,
            content,
            uid: expectedUid,
            source: expectedSource,
          });
        }
        resolve(payload);
      };
      req.onerror = (event) => reject(event);
    });
  }

  async remapCategoryUuid(oldUuid: string, newUuid: string): Promise<void> {
    const normalizedOld = this.normalizeUuid(oldUuid);
    const normalizedNew = this.normalizeUuid(newUuid);
    if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return;
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("categories")) return;
    const stores = ["categories"];
    if (db.objectStoreNames.contains("article_meta")) {
      stores.push("article_meta");
    }
    const tx = db.transaction(stores, "readwrite");
    const categoryStore = tx.objectStore("categories");
    const index = categoryStore.index("category_id");
    const req = index.openCursor(IDBKeyRange.only(normalizedOld));
    req.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
      if (!cursor) return;
      const current = cursor.value as Category;
      if (this.matchesScope(current as any)) {
        cursor.update({
          ...current,
          category_id: normalizedNew,
          updatedAt: new Date(),
        });
      }
      cursor.continue();
    };
    if (stores.includes("article_meta")) {
      const metaStore = tx.objectStore("article_meta");
      const cursorReq = metaStore.openCursor();
      cursorReq.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (!cursor) return;
        const record = cursor.value as DocumentMeta;
        if (this.matchesScope(record as any) && (record as any).category_id === normalizedOld) {
          cursor.update({
            ...record,
            category_id: normalizedNew,
          });
        }
        cursor.continue();
      };
    }
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
    });
  }

  async remapDocumentUuid(oldUuid: string, newUuid: string): Promise<void> {
    const normalizedOld = this.normalizeUuid(oldUuid);
    const normalizedNew = this.normalizeUuid(newUuid);
    if (!normalizedOld || !normalizedNew || normalizedOld === normalizedNew) return;
    const db = await this.getDb();
    if (!db.objectStoreNames.contains("article_meta")) return;
    const stores = ["article_meta"];
    if (db.objectStoreNames.contains("article_content")) {
      stores.push("article_content");
    }
    const tx = db.transaction(stores, "readwrite");
    const metaStore = tx.objectStore("article_meta");
    const metaReq = metaStore.get(normalizedOld);
    metaReq.onsuccess = () => {
      const current = (metaReq.result || null) as DocumentMeta | null;
      if (current && this.matchesScope(current as any)) {
        metaStore.put({
          ...current,
          document_id: normalizedNew,
          updatedAt: new Date(),
        });
        metaStore.delete(normalizedOld);
      }
      if (stores.includes("article_content")) {
        const contentStore = tx.objectStore("article_content");
        const contentReq = contentStore.get(normalizedOld);
        contentReq.onsuccess = () => {
          const contentRow = contentReq.result as {document_id: string; content?: string; uid?: number; source?: string};
          if (contentRow && this.matchesScope(contentRow as any)) {
            contentStore.put({
              ...contentRow,
              document_id: normalizedNew,
            });
            contentStore.delete(normalizedOld);
          }
        };
      }
    };
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
    });
  }

  async clearRemoteData(): Promise<void> {
    const db = await this.getDb();
    const stores: string[] = [];
    if (db.objectStoreNames.contains("categories")) stores.push("categories");
    if (db.objectStoreNames.contains("article_meta")) stores.push("article_meta");
    if (db.objectStoreNames.contains("article_content")) stores.push("article_content");
    if (stores.length === 0) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(stores, "readwrite");
      stores.forEach((name) => {
        const store = tx.objectStore(name);
        const req = store.openCursor();
        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
          if (!cursor) return;
          const record = cursor.value as {uid?: number; source?: string};
          const uid = this.normalizeUid(record.uid);
          if (uid === this.userId && this.normalizeSource(record.source) === "remote") {
            cursor.delete();
          }
          cursor.continue();
        };
      });
      tx.oncomplete = () => resolve();
      tx.onerror = (event) => reject(event);
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
          if (this.matchesScope(value as any)) {
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
            if (this.matchesScope(value as any)) {
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
          if (this.matchesScope(value as any)) {
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
          const legacyId = legacy.id as number;
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
          const documentUuid = this.generateUuid();
          const meta: DocumentMeta = {
            id: legacyId,
            document_id: documentUuid,
            name: (legacy.name as string) || "未命名.md",
            charCount,
            category_id: DEFAULT_CATEGORY_UUID,
            createdAt,
            updatedAt,
            uid: this.userId,
            source: this.defaultSource,
            version: 1,
          };
          metaStore.put(meta);
          contentStore.put({
            document_id: documentUuid,
            content,
            uid: this.userId,
            source: this.defaultSource,
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
