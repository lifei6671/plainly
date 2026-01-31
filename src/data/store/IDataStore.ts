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
  deleteDocument(documentId: number): Promise<void>;
}

export type {
  Category,
  CategoryWithCount,
  DataStoreMode,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
};
