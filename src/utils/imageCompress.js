function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fileToImageBitmap(file) {
  // createImageBitmap 在主流浏览器/多数 WebView 可用
  return createImageBitmap(file);
}

function calcTargetSize(w, h, {maxWidth = 2560, maxHeight = 2560} = {}) {
  const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
  return {
    width: Math.max(1, Math.round(w * ratio)),
    height: Math.max(1, Math.round(h * ratio)),
  };
}

async function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), type, quality);
  });
}

/**
 * 压缩（缩放）+ 转 WebP，浏览器优先，WASM 兜底
 * @param {File|Blob} file
 * @param {Object} opts
 * @param {number} opts.quality 0~1，建议 0.75~0.88
 * @param {number} opts.maxWidth
 * @param {number} opts.maxHeight
 * @returns {Promise<Blob>} image/webp
 */
export default async function compressThenWebp(file, opts = {}) {
  const quality = clamp(opts.quality ?? 0.82, 0.05, 0.98);
  const maxWidth = opts.maxWidth ?? 2560;
  const maxHeight = opts.maxHeight ?? 2560;

  const bitmap = await fileToImageBitmap(file);
  const {width, height} = calcTargetSize(bitmap.width, bitmap.height, {maxWidth, maxHeight});

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", {alpha: true});

  // 画到目标尺寸（压缩主要发生在这里）
  ctx.drawImage(bitmap, 0, 0, width, height);

  // A：原生 WebP
  const webpBlob = await canvasToBlob(canvas, "image/webp", quality);
  if (webpBlob && webpBlob.type === "image/webp") {
    return webpBlob;
  }

  // B：WASM 兜底（@jsquash/webp）
  // 注意：这是动态 import，只有失败才加载 WASM，避免包体暴涨
  const {encode} = await import("@jsquash/webp"); // :contentReference[oaicite:3]{index=3}

  const imageData = ctx.getImageData(0, 0, width, height);
  const webpBytes = await encode(imageData, {
    quality: Math.round(quality * 100),
  });

  return new Blob([webpBytes], {type: "image/webp"});
}
