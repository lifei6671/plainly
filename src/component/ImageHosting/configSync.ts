import type {HostingConfigMap} from "./types";

type LoadHostingConfigOptions<T extends HostingConfigMap> = {
  key: string;
  defaults: T;
  getConfig: (key: string, fallback?: T) => Promise<T | null | undefined>;
  hydrateConfigSync?: (key: string, value: T) => void;
  setConfigSync?: (key: string, value: T) => void;
};

type ResolveHostingConfigOptions<T extends HostingConfigMap> = {
  key: string;
  fallback?: T;
  getConfigSync: (key: string, fallback: T) => T | string | null;
  getConfig: (key: string, fallback: T) => Promise<T | null | undefined>;
  hydrateConfigSync?: (key: string, value: T) => void;
  setConfigSync?: (key: string, value: T) => void;
};

type PersistHostingConfigOptions<T extends HostingConfigMap> = {
  key: string;
  value: T;
  setConfigSync: (key: string, value: T) => void;
};

export const loadHostingConfig = async <T extends HostingConfigMap>({
  key,
  defaults,
  getConfig,
  hydrateConfigSync,
  setConfigSync,
}: LoadHostingConfigOptions<T>) => {
  const stored = (await getConfig(key)) || {};
  const nextConfig: T = {
    ...defaults,
    ...stored,
  };
  const syncConfig = hydrateConfigSync || setConfigSync;
  if (stored && typeof stored === "object" && Object.keys(stored).length > 0) {
    syncConfig(key, nextConfig);
  }
  return nextConfig;
};

export const resolveHostingConfig = async <T extends HostingConfigMap>({
  key,
  fallback,
  getConfigSync,
  getConfig,
  hydrateConfigSync,
  setConfigSync,
}: ResolveHostingConfigOptions<T>) => {
  const resolvedFallback = (fallback ?? ({} as T)) as T;
  const localConfig = ((getConfigSync(key, resolvedFallback) || resolvedFallback) ?? resolvedFallback) as T;
  if (localConfig && typeof localConfig === "object" && Object.keys(localConfig).length > 0) {
    return localConfig;
  }
  const stored = ((await getConfig(key, resolvedFallback)) || resolvedFallback) as T;
  const syncConfig = hydrateConfigSync || setConfigSync;
  if (stored && typeof stored === "object" && Object.keys(stored).length > 0) {
    syncConfig(key, stored);
  }
  return stored;
};

export const persistHostingConfig = <T extends HostingConfigMap>({
  key,
  value,
  setConfigSync,
}: PersistHostingConfigOptions<T>) => {
  const nextConfig: T = {
    ...value,
  };
  setConfigSync(key, nextConfig);
  return nextConfig;
};

export default {
  loadHostingConfig,
  resolveHostingConfig,
  persistHostingConfig,
};
