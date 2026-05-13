function base64ToUrlSafe(b64) {
  return b64.replace(/\+/g, "-").replace(/\//g, "_");
}

function utf8ToBytes(str) {
  return new TextEncoder().encode(str);
}

function bytesToBase64(bytes) {
  // 小文件场景足够；避免一次性 spread 太大数组
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function hmacSha1(secretKey, message) {
  // eslint-disable-next-line no-undef
  if (!globalThis.crypto || !crypto.subtle) {
    throw new Error("当前环境不支持 WebCrypto：crypto.subtle 不可用");
  }
  const key = await crypto.subtle.importKey("raw", utf8ToBytes(secretKey), {name: "HMAC", hash: "SHA-1"}, false, [
    "sign",
  ]);
  const sig = await crypto.subtle.sign("HMAC", key, utf8ToBytes(message));
  return new Uint8Array(sig);
}

/**
 * 生成七牛 uploadToken
 * @param {Object} opts
 * @param {string} opts.accessKey
 * @param {string} opts.secretKey
 * @param {string} opts.bucket
 * @param {string=} opts.key  可选；传了就是 bucket:key，更收敛
 * @param {number=} opts.expiresSeconds 默认 3600
 * @param {Object=} opts.extraPolicy 额外 putPolicy 字段（returnBody / insertOnly 等）
 */
export default async function createQiniuUploadToken({
  accessKey,
  secretKey,
  bucket,
  key,
  expiresSeconds = 3600,
  extraPolicy = {},
}) {
  if (!accessKey || !secretKey || !bucket) {
    throw new Error("accessKey / secretKey / bucket 不能为空");
  }

  const scope = key ? `${bucket}:${key}` : bucket;
  const deadline = Math.floor(Date.now() / 1000) + Math.max(1, expiresSeconds);

  const putPolicy = {
    scope,
    deadline,
    ...extraPolicy,
  };

  const putPolicyJson = JSON.stringify(putPolicy);
  const encodedPutPolicy = base64ToUrlSafe(bytesToBase64(utf8ToBytes(putPolicyJson)));

  const signBytes = await hmacSha1(secretKey, encodedPutPolicy);
  const encodedSign = base64ToUrlSafe(bytesToBase64(signBytes));

  // 七牛官方拼接格式：AK:encodedSign:encodedPutPolicy :contentReference[oaicite:1]{index=1}
  return `${accessKey}:${encodedSign}:${encodedPutPolicy}`;
}
