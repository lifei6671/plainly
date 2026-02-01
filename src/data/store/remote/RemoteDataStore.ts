import {IDataStore} from "../IDataStore";
import {Category, CategoryWithCount, DocumentMeta, NewDocumentPayload, UpdateDocumentMetaInput} from "../types";
import {ensureJiebaReady, tokenizeForSearch} from "../../../search/jieba-tokenizer";

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
const SESSION_FLAG_COOKIE = "plainly_session";

export class RemoteDataStore implements IDataStore {
  constructor(private baseUrl: string = "/api", private userId: number = 0) {}

  setUserId(uid: number) {
    this.userId = uid;
  }

  private hasSessionCookie(): boolean {
    if (typeof document === "undefined") return false;
    return document.cookie.split(";").some((item) => item.trim().startsWith(`${SESSION_FLAG_COOKIE}=`));
  }

  private async refreshSession(): Promise<boolean> {
    if (!this.hasSessionCookie()) return false;
    const response = await fetch(`${this.baseUrl}/auth/refresh`, {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      credentials: "include",
    });
    const payload = (await response.json().catch(() => null)) as {errcode?: number};
    return response.ok && (!payload || payload.errcode === 0);
  }

  private async request<T>(
    path: string,
    method: HttpMethod = "GET",
    body?: unknown,
    retry = true,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.userId > 0) {
      headers["X-User-Id"] = String(this.userId);
    }
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      credentials: "include",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (response.status === 401 && retry && this.hasSessionCookie()) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        return this.request<T>(path, method, body, false);
      }
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Request failed: ${response.status} ${text}`);
    }
    const payload = (await response.json()) as {errcode?: number; errmsg?: string; data?: T};
    if (payload && payload.errcode !== undefined && payload.errcode !== 0) {
      throw new Error(payload.errmsg || "Request failed");
    }
    return (payload && ("data" in payload ? (payload.data as T) : (payload as unknown as T))) as T;
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

  createCategory(
    name: string,
    options?: {category_id?: string; source?: "local" | "remote"; version?: number},
  ): Promise<Category> {
    return this.request<Category>("/categories", "POST", {
      name,
      category_id: options?.category_id,
      source: options?.source,
      version: options?.version,
    });
  }

  renameCategory(categoryId: string, name: string): Promise<void> {
    return this.request<void>(`/categories/${encodeURIComponent(categoryId)}`, "PATCH", {name});
  }

  deleteCategory(categoryId: string, options?: {reassignTo?: string}): Promise<void> {
    const params = new URLSearchParams();
    if (options?.reassignTo != null) params.set("reassignTo", String(options.reassignTo));
    return this.request<void>(`/categories/${encodeURIComponent(categoryId)}?${params.toString()}`, "DELETE");
  }

  createDocument(meta: NewDocumentPayload, content: string): Promise<DocumentMeta> {
    const payload = {...meta, uid: meta.uid ?? (this.userId > 0 ? this.userId : undefined)};
    return this.request<DocumentMeta>("/documents", "POST", {meta: payload, content});
  }

  getDocumentMeta(documentId: string): Promise<DocumentMeta | null> {
    return this.request<DocumentMeta | null>(`/documents/${encodeURIComponent(documentId)}/meta`);
  }

  updateDocumentMeta(documentId: string, updates: UpdateDocumentMetaInput): Promise<void> {
    return this.request<void>(`/documents/${encodeURIComponent(documentId)}/meta`, "PATCH", updates);
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

  async searchDocuments(
    query: string,
    options?: {categoryId?: string; offset?: number; limit?: number},
  ): Promise<{items: DocumentMeta[]; hasMore: boolean}> {
    const trimmed = String(query || "").trim();
    const limit = Math.max(1, Number(options?.limit ?? 20));
    const offset = Math.max(0, Number(options?.offset ?? 0));
    if (!trimmed) {
      const items = await this.listAllDocuments();
      const filtered = options?.categoryId
        ? items.filter((item) => item.category_id === options.categoryId)
        : items;
      return {
        items: filtered.slice(offset, offset + limit),
        hasMore: filtered.length > offset + limit,
      };
    }
    await ensureJiebaReady();
    const tokens = tokenizeForSearch(trimmed);
    if (!tokens.length) return {items: [], hasMore: false};
    return this.request(`/documents/search`, "POST", {
      tokens,
      category_id: options?.categoryId,
      offset,
      limit,
    });
  }

  ensureDocumentCharCount(meta: DocumentMeta): Promise<DocumentMeta> {
    return this.request<DocumentMeta>(`/documents/${encodeURIComponent(meta.document_id)}/charcount`, "POST", meta);
  }

  getDocumentContent(documentId: string): Promise<string> {
    return this.request<string>(`/documents/${encodeURIComponent(documentId)}/content`);
  }

  saveDocumentContent(documentId: string, content: string, updatedAt?: number | string | Date): Promise<void> {
    return this.request<void>(`/documents/${encodeURIComponent(documentId)}/content`, "PUT", {content, updatedAt});
  }

  deleteDocument(documentId: string): Promise<void> {
    return this.request<void>(`/documents/${encodeURIComponent(documentId)}`, "DELETE");
  }

  batchCreateCategories(
    items: Array<{name: string; category_id?: string; source?: "local" | "remote"; version?: number}>,
  ): Promise<{items: Array<{client_id?: string; category?: Category; error?: string}>}> {
    return this.request(`/categories/batch`, "POST", {items});
  }

  batchCreateDocuments(
    items: Array<{meta: NewDocumentPayload; content: string}>,
  ): Promise<{items: Array<{client_id?: string; document?: DocumentMeta; error?: string}>}> {
    return this.request(`/documents/batch`, "POST", {items});
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
