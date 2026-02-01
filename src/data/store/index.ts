import {BrowserDataStore} from "./browser/BrowserDataStore";
import {RemoteDataStore} from "./remote/RemoteDataStore";
import {DataStoreMode, IDataStore} from "./IDataStore";

export const DEFAULT_DATA_STORE_MODE: DataStoreMode = "remote";

let cachedStore: IDataStore | null = null;
let cachedMode: DataStoreMode = DEFAULT_DATA_STORE_MODE;
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
  return DEFAULT_DATA_STORE_MODE;
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

export function getDataStore(modeOrUserId?: DataStoreMode | number, userId?: number): IDataStore {
  let resolvedUserId = userId;
  let desiredMode: DataStoreMode | undefined;
  if (typeof modeOrUserId === "number") {
    resolvedUserId = modeOrUserId;
  } else if (typeof modeOrUserId === "string") {
    desiredMode = modeOrUserId as DataStoreMode;
  }
  const finalUserId = resolvedUserId ?? resolveDefaultUserId();
  const finalMode = desiredMode || resolveDefaultMode();
  const shouldForceBrowser =
    (finalMode === "remote" && (!finalUserId || finalUserId <= 0)) ||
    (finalMode === "node" && (!finalUserId || finalUserId <= 0));
  const effectiveMode = shouldForceBrowser ? "browser" : finalMode;

  if (!cachedStore || cachedMode !== effectiveMode || cachedUserId !== finalUserId) {
    switch (effectiveMode) {
      case "browser":
      default:
        cachedStore = new BrowserDataStore(finalUserId || 0);
        cachedMode = effectiveMode;
        cachedUserId = finalUserId || 0;
        break;
      case "remote": {
        const baseUrl =
          (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) ||
          (typeof process !== "undefined" && process.env?.VITE_API_BASE) ||
          "/api";
        cachedStore = new RemoteDataStore(baseUrl, finalUserId);
        cachedMode = effectiveMode;
        cachedUserId = finalUserId;
        break;
      }
    }
  }
  return cachedStore;
}

export * from "./IDataStore";
