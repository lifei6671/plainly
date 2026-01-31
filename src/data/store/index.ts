import {BrowserDataStore} from "./browser/BrowserDataStore";
import {DataStoreMode, IDataStore} from "./IDataStore";

let cachedStore: IDataStore | null = null;
let cachedMode: DataStoreMode = "browser";

export function getDataStore(mode: DataStoreMode = "browser"): IDataStore {
  if (!cachedStore || cachedMode !== mode) {
    switch (mode) {
      case "browser":
      default:
        cachedStore = new BrowserDataStore();
        cachedMode = mode;
        break;
    }
  }
  return cachedStore;
}

export * from "./IDataStore";
