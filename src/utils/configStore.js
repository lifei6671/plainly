import {getDataStore} from "../data/store";

const resolveMode = () => {
  // 优先前端环境变量
  if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_DATA_STORE) {
    return import.meta.env.VITE_DATA_STORE;
  }
  // 其次使用全局注入（例如 window.__DATA_STORE_MODE__）
  if (typeof window !== "undefined" && window.__DATA_STORE_MODE__) {
    return window.__DATA_STORE_MODE__;
  }
  // 服务器环境可以用 process.env
  if (typeof process !== "undefined" && process.env && process.env.DATA_STORE_MODE) {
    return process.env.DATA_STORE_MODE;
  }
  return "browser";
};

const runtimeMode = resolveMode();
const runtimeStore = getDataStore(runtimeMode);

const memoryStore = new Map();

const getStorage = () => {
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  return null;
};

const serialize = (value) => {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch (_e) {
    return String(value);
  }
};

const deserialize = (raw, fallback) => {
  if (raw == null) {
    return fallback ?? null;
  }
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return raw;
  }
};

export const getConfigSync = (key, fallback) => {
  const storage = getStorage();
  const raw = storage ? storage.getItem(key) : memoryStore.get(key);
  return deserialize(raw, fallback ?? null);
};

export const setConfigSync = (key, value) => {
  const raw = serialize(value);
  const storage = getStorage();
  if (storage) {
    storage.setItem(key, raw);
  }
  memoryStore.set(key, raw);
  void runtimeStore.setConfig(key, value);
};

export const removeConfigSync = (key) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  }
  memoryStore.delete(key);
  void runtimeStore.removeConfig(key);
};

export const listConfigKeysSync = (prefix) => {
  const storage = getStorage();
  const keys = [];
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

export const getConfig = async (key, fallback) => runtimeStore.getConfig(key, fallback);
export const setConfig = async (key, value) => runtimeStore.setConfig(key, value);
export const removeConfig = async (key) => runtimeStore.removeConfig(key);
export const listConfigKeys = async (prefix) => runtimeStore.listConfigKeys(prefix);
