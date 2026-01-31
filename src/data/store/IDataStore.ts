import {
  Category,
  CategoryWithCount,
  DataStoreMode,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
} from "./types";

export interface IDataStore {
  init(): Promise<void>;
  listCategories(): Promise<Category[]>;
  listCategoriesWithCount(): Promise<CategoryWithCount[]>;
  createCategory(name: string): Promise<Category>;
  renameCategory(id: number, name: string): Promise<void>;
  deleteCategory(id: number, options?: {reassignTo?: number}): Promise<void>;
  createDocument(meta: NewDocumentPayload, content: string): Promise<number>;
  getDocumentMeta(documentId: number): Promise<DocumentMeta | null>;
  updateDocumentMeta(documentId: number, updates: UpdateDocumentMetaInput): Promise<void>;
  listDocumentsPage(
    offset: number,
    limit: number,
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}>;
  listAllDocuments(): Promise<DocumentMeta[]>;
  ensureDocumentCharCount(meta: DocumentMeta): Promise<DocumentMeta>;
  getDocumentContent(documentId: number): Promise<string>;
  saveDocumentContent(documentId: number, content: string, updatedAt?: TimestampValue): Promise<void>;
  deleteDocument(documentId: number): Promise<void>;
  /**
   * 轻量配置读取：抽象 localStorage / KV / 文件等环境差异
   * key 为全局唯一字符串，value 建议为可 JSON 序列化对象
   */
  getConfig<T = unknown>(key: string, fallback?: T): Promise<T | null>;
  setConfig<T = unknown>(key: string, value: T): Promise<void>;
  removeConfig(key: string): Promise<void>;
  listConfigKeys(prefix?: string): Promise<string[]>;
}

export type {
  Category,
  CategoryWithCount,
  DataStoreMode,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
};
