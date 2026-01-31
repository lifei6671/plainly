import {BrowserDataStore} from "./browser/BrowserDataStore";
import {RemoteDataStore} from "./remote/RemoteDataStore";
import {DataStoreMode, IDataStore} from "./IDataStore";

let cachedStore: IDataStore | null = null;
let cachedMode: DataStoreMode = "remote";

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

export function getDataStore(mode?: DataStoreMode): IDataStore {
  const effectiveMode = mode || resolveDefaultMode();
  if (!cachedStore || cachedMode !== effectiveMode) {
    switch (effectiveMode) {
      case "browser":
      default:
        cachedStore = new BrowserDataStore();
        cachedMode = effectiveMode;
        break;
      case "remote": {
        const baseUrl =
          (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE) ||
          (typeof process !== "undefined" && process.env?.VITE_API_BASE) ||
          "/api";
        cachedStore = new RemoteDataStore(baseUrl);
        cachedMode = effectiveMode;
        break;
      }
    }
  }
  return cachedStore;
}

export * from "./IDataStore";
