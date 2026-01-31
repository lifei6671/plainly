import {IDataStore} from "../IDataStore";
import {
  Category,
  CategoryWithCount,
  DocumentMeta,
  NewDocumentPayload,
  UpdateDocumentMetaInput,
} from "../types";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export class RemoteDataStore implements IDataStore {
  constructor(private baseUrl: string = "/api") {}

  private async request<T>(path: string, method: HttpMethod = "GET", body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Request failed: ${response.status} ${text}`);
    }
    return (await response.json()) as T;
  }

  async init(): Promise<void> {
    return;
  }

  listCategories(): Promise<Category[]> {
    return this.request<Category[]>("/categories");
  }

  listCategoriesWithCount(): Promise<CategoryWithCount[]> {
    return this.request<CategoryWithCount[]>("/categories/count");
  }

  createCategory(name: string): Promise<Category> {
    return this.request<Category>("/categories", "POST", {name});
  }

  renameCategory(id: number, name: string): Promise<void> {
    return this.request<void>(`/categories/${id}`, "PATCH", {name});
  }

  deleteCategory(id: number, options?: {reassignTo?: number}): Promise<void> {
    const params = new URLSearchParams();
    if (options?.reassignTo != null) params.set("reassignTo", String(options.reassignTo));
    return this.request<void>(`/categories/${id}?${params.toString()}`, "DELETE");
  }

  createDocument(meta: NewDocumentPayload, content: string): Promise<number> {
    return this.request<number>("/documents", "POST", {meta, content});
  }

  getDocumentMeta(documentId: number): Promise<DocumentMeta | null> {
    return this.request<DocumentMeta | null>(`/documents/${documentId}/meta`);
  }

  updateDocumentMeta(documentId: number, updates: UpdateDocumentMetaInput): Promise<void> {
    return this.request<void>(`/documents/${documentId}/meta`, "PATCH", updates);
  }

  listDocumentsPage(
    offset: number,
    limit: number,
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    const params = new URLSearchParams({offset: String(offset), limit: String(limit)});
    return this.request(`/documents?${params.toString()}`);
  }

  listAllDocuments(): Promise<DocumentMeta[]> {
    return this.request<DocumentMeta[]>("/documents/all");
  }

  ensureDocumentCharCount(meta: DocumentMeta): Promise<DocumentMeta> {
    return this.request<DocumentMeta>(`/documents/${meta.document_id}/charcount`, "POST", meta);
  }

  getDocumentContent(documentId: number): Promise<string> {
    return this.request<string>(`/documents/${documentId}/content`);
  }

  deleteDocument(documentId: number): Promise<void> {
    return this.request<void>(`/documents/${documentId}`, "DELETE");
  }

  getConfig<T = unknown>(key: string, fallback?: T): Promise<T | null> {
    const params = new URLSearchParams();
    if (fallback !== undefined) params.set("fallback", JSON.stringify(fallback));
    return this.request<T | null>(`/config/${encodeURIComponent(key)}?${params.toString()}`);
  }

  setConfig<T = unknown>(key: string, value: T): Promise<void> {
    return this.request<void>(`/config/${encodeURIComponent(key)}`, "PUT", {value});
  }

  removeConfig(key: string): Promise<void> {
    return this.request<void>(`/config/${encodeURIComponent(key)}`, "DELETE");
  }

  listConfigKeys(prefix?: string): Promise<string[]> {
    const params = new URLSearchParams();
    if (prefix) params.set("prefix", prefix);
    return this.request<string[]>(`/config?${params.toString()}`);
  }
}
