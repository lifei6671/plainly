import {getDataStore} from "../data/store";
import {filterRemoteConfigKeys, isRemoteConfigKeyAllowed} from "./remoteConfigWhitelist";

const memoryStore = new Map<string, string>();

const getStorage = (): Storage | null => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const serialize = (value: unknown): string => {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_e) {
    return String(value);
  }
};

const deserialize = <T>(raw: string | null | undefined, fallback: T): T | string | null => {
  if (raw == null) {
    return fallback ?? null;
  }
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return raw;
  }
};

const writeLocalConfigSync = (key: string, value: unknown) => {
  const raw = serialize(value);
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, raw);
  }
  memoryStore.set(key, raw);
};

export const getConfigSync = <T>(key: string, fallback: T) => {
  const storage = getStorage();
  const raw = storage ? storage.getItem(key) : memoryStore.get(key);
  return deserialize(raw, fallback ?? null);
};

export const hydrateConfigSync = (key: string, value: unknown) => {
  writeLocalConfigSync(key, value);
};

export const setConfigSync = (key: string, value: unknown) => {
  writeLocalConfigSync(key, value);
  // 登录态会在运行时切换，这里必须按当前上下文动态获取 store。
  if (isRemoteConfigKeyAllowed(key)) {
    getDataStore().setConfig(key, value).catch(console.error);
  }
};

export const removeConfigSync = (key: string) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  }
  memoryStore.delete(key);
  if (isRemoteConfigKeyAllowed(key)) {
    getDataStore().removeConfig(key).catch(console.error);
  }
};

export const listConfigKeysSync = (prefix?: string) => {
  const storage = getStorage();
  const keys: string[] = [];
  if (storage) {
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && (!prefix || key.startsWith(prefix))) {
        keys.push(key);
      }
    }
  } else {
    memoryStore.forEach((_value, key) => {
      if (!prefix || key.startsWith(prefix)) {
        keys.push(key);
      }
    });
  }
  return keys;
};

export const getConfig = async <T>(key: string, fallback: T) => getDataStore().getConfig(key, fallback);
export const setConfig = async (key: string, value: unknown) => {
  writeLocalConfigSync(key, value);
  if (!isRemoteConfigKeyAllowed(key)) {
    return undefined;
  }
  return getDataStore().setConfig(key, value);
};
export const removeConfig = async (key: string) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  }
  memoryStore.delete(key);
  if (!isRemoteConfigKeyAllowed(key)) {
    return undefined;
  }
  return getDataStore().removeConfig(key);
};
export const listConfigKeys = async (prefix?: string) => {
  const keys = await getDataStore().listConfigKeys(prefix);
  return filterRemoteConfigKeys(keys);
};
