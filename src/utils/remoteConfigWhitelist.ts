import {
  ALIOSS_IMAGE_HOSTING,
  IMAGE_HOSTING_TYPE,
  QINIUOSS_IMAGE_HOSTING,
  R2_IMAGE_HOSTING,
  SM_MS_TOKEN,
} from "./constant";

export const REMOTE_CONFIG_WHITELIST = [
  SM_MS_TOKEN,
  R2_IMAGE_HOSTING,
  ALIOSS_IMAGE_HOSTING,
  QINIUOSS_IMAGE_HOSTING,
  IMAGE_HOSTING_TYPE,
] as const;

const remoteConfigKeySet = new Set<string>(REMOTE_CONFIG_WHITELIST);

export const isRemoteConfigKeyAllowed = (key: string) => remoteConfigKeySet.has(String(key || ""));

export const filterRemoteConfigKeys = (keys: string[]) => keys.filter((key) => isRemoteConfigKeyAllowed(key));
