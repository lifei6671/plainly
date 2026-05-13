import {getDataStore} from "../data/store";

const runtimeStore = getDataStore();

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
  runtimeStore.setConfig(key, value).catch(console.error);
};

export const removeConfigSync = (key: string) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  }
  memoryStore.delete(key);
  runtimeStore.removeConfig(key).catch(console.error);
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

export const getConfig = async <T>(key: string, fallback: T) => runtimeStore.getConfig(key, fallback);
export const setConfig = async (key: string, value: unknown) => runtimeStore.setConfig(key, value);
export const removeConfig = async (key: string) => runtimeStore.removeConfig(key);
export const listConfigKeys = async (prefix?: string) => runtimeStore.listConfigKeys(prefix);
