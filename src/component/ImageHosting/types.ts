export type AliOSSConfig = {
  region: string;
  accessKeyId: string;
  accessKeySecret: string;
  bucket: string;
};

export type QiniuOSSConfig = {
  bucket: string;
  region: string;
  accessKey: string;
  secretKey: string;
  domain: string;
  namespace: string;
};

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  publicBaseUrl: string;
  namespace: string;
  size: number;
  quality: number;
  filenameTemplate: string;
};

export type HostingConfigMap = Record<string, unknown>;
