import {getDataStore} from "../data/store";

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
  void getDataStore().setConfig(key, value);
};

export const removeConfigSync = (key) => {
  const storage = getStorage();
  if (storage) {
    storage.removeItem(key);
  }
  memoryStore.delete(key);
  void getDataStore().removeConfig(key);
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

export const getConfig = async (key, fallback) => getDataStore().getConfig(key, fallback);
export const setConfig = async (key, value) => getDataStore().setConfig(key, value);
export const removeConfig = async (key) => getDataStore().removeConfig(key);
export const listConfigKeys = async (prefix) => getDataStore().listConfigKeys(prefix);
