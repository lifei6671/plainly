export const loadHostingConfig = async ({key, defaults, getConfig, hydrateConfigSync, setConfigSync}) => {
  const stored = (await getConfig(key)) || {};
  const nextConfig = {
    ...defaults,
    ...stored,
  };
  const syncConfig = hydrateConfigSync || setConfigSync;
  if (stored && typeof stored === "object" && Object.keys(stored).length > 0) {
    syncConfig(key, nextConfig);
  }
  return nextConfig;
};

export const resolveHostingConfig = async ({
  key,
  fallback = {},
  getConfigSync,
  getConfig,
  hydrateConfigSync,
  setConfigSync,
}) => {
  const localConfig = (getConfigSync(key, fallback) || fallback) ?? fallback;
  if (localConfig && typeof localConfig === "object" && Object.keys(localConfig).length > 0) {
    return localConfig;
  }
  const stored = (await getConfig(key, fallback)) || fallback;
  const syncConfig = hydrateConfigSync || setConfigSync;
  if (stored && typeof stored === "object" && Object.keys(stored).length > 0) {
    syncConfig(key, stored);
  }
  return stored;
};

export const persistHostingConfig = ({key, value, setConfigSync}) => {
  const nextConfig = {
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
