import {BrowserDataStore} from "./browser/BrowserDataStore";
import {RemoteDataStore} from "./remote/RemoteDataStore";
import {DataStoreMode, IDataStore} from "./IDataStore";

let cachedStore: IDataStore | null = null;
let cachedMode: DataStoreMode = "remote";
let cachedUserId: number | null = null;

const resolveDefaultMode = (): DataStoreMode => {
  // 前端 vite 环境变量
  if (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_DATA_STORE) {
    return (import.meta as any).env.VITE_DATA_STORE as DataStoreMode;
  }
  // 运行时注入
  if (typeof window !== "undefined" && (window as any).__DATA_STORE_MODE__) {
    return (window as any).__DATA_STORE_MODE__ as DataStoreMode;
  }
  // node 环境变量
  if (typeof process !== "undefined" && process.env?.DATA_STORE_MODE) {
    return process.env.DATA_STORE_MODE as DataStoreMode;
  }
  return "browser";
};

const resolveDefaultUserId = (): number => {
  if (typeof window !== "undefined") {
    const globalId =
      (window as any).__USER_ID__ ??
      (window as any).__CURRENT_USER_ID__ ??
      (window as any).__DATA_STORE_USER_ID__;
    if (typeof globalId === "number" && Number.isFinite(globalId)) {
      return globalId;
    }
    if (window.localStorage) {
      const stored = window.localStorage.getItem("plainly_user_id");
      if (stored) {
        const parsed = Number(stored);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          return parsed;
        }
      }
    }
    if ((window as any).__DATA_STORE_USER__) {
      const maybeId = Number((window as any).__DATA_STORE_USER__?.id);
      if (!Number.isNaN(maybeId)) return maybeId;
    }
    if (typeof (import.meta as any)?.env?.VITE_USER_ID !== "undefined") {
      const parsed = Number((import.meta as any).env.VITE_USER_ID);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  if (typeof process !== "undefined") {
    if (process.env?.DATA_STORE_USER_ID) {
      const parsed = Number(process.env.DATA_STORE_USER_ID);
      if (!Number.isNaN(parsed)) return parsed;
    }
    if (process.env?.USER_ID) {
      const parsed = Number(process.env.USER_ID);
      if (!Number.isNaN(parsed)) return parsed;
    }
  }
  return 0;
};

export function getDataStore(mode?: DataStoreMode, userId?: number): IDataStore {
  const resolvedUserId = userId ?? resolveDefaultUserId();
  const desiredMode = mode || resolveDefaultMode();
  const shouldForceBrowser =
    (desiredMode === "remote" || desiredMode === "node") && (!resolvedUserId || resolvedUserId <= 0);
  const effectiveMode = shouldForceBrowser ? "browser" : desiredMode;

  if (!cachedStore || cachedMode !== effectiveMode || cachedUserId !== resolvedUserId) {
    switch (effectiveMode) {
      case "browser":
      default:
        cachedStore = new BrowserDataStore(resolvedUserId || 0);
        cachedMode = effectiveMode;
        cachedUserId = resolvedUserId || 0;
        break;
      case "remote": {
        const baseUrl =
          (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) ||
          (typeof process !== "undefined" && process.env?.VITE_API_BASE) ||
          "/api";
        cachedStore = new RemoteDataStore(baseUrl, resolvedUserId);
        cachedMode = effectiveMode;
        cachedUserId = resolvedUserId;
        break;
      }
    }
  }
  return cachedStore;
}

export * from "./IDataStore";
