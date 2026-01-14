function pad2(n) {
  return String(n).padStart(2, "0");
}

function sanitizeSegment(s) {
  // 用于对象存储 key 的“单段”清洗：不允许路径分隔与危险字符
  // 你如果想保留中文，这里是允许的
  return String(s ?? "")
    .replace(/[\/\\]+/g, "_")
    .replace(/[\u0000-\u001F\u007F]+/g, "") // 控制字符
    .replace(/[<>:"|?*\x00]+/g, "_") // 常见非法字符
    .replace(/\s+/g, "_")
    .trim()
    .slice(0, 120); // 防止过长
}

function getBaseName(filename) {
  const name = String(filename ?? "file");
  const base = name.replace(/\.[^.]+$/, ""); // 去扩展名
  const safe = sanitizeSegment(base);
  return safe || "file";
}

function getExt(filename, fallbackExt = "webp") {
  const m = String(filename ?? "").match(/\.([^.]+)$/);
  const ext = m && m[1] ? m[1] : fallbackExt;
  return sanitizeSegment(ext.toLowerCase()) || fallbackExt;
}

function randAlphaNum(len = 6) {
  const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function uuidV4() {
  if (crypto.randomUUID) return crypto.randomUUID();
  // 降级：非严格 UUID，但足够作为唯一标识
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  // eslint-disable-next-line no-bitwise
  a[6] = (a[6] & 0x0f) | 0x40;
  // eslint-disable-next-line no-bitwise
  a[8] = (a[8] & 0x3f) | 0x80;
  const hex = [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * 渲染命名模板
 * @param {string} template 例如: "image_${UUID}_${YYYY}_${RAND:6}_${DD}_${MM}_${Timestamp}.${EXT}"
 * @param {Object} ctx 上下文
 * @param {File|Blob=} ctx.file
 * @param {string=} ctx.namespace
 * @param {Date=} ctx.now
 * @param {string=} ctx.forceExt 强制输出扩展名（例如你转 webp 就写 "webp"）
 * @returns {string} 安全文件名（不包含目录前缀时就是文件名；你也可以在外面拼 prefix）
 */
export default function renderObjectName(template, ctx = {}) {
  const now = ctx.now instanceof Date ? ctx.now : new Date();

  const originalName = ctx.file?.name || "file";
  const name = getBaseName(originalName);
  const ext = sanitizeSegment(ctx.forceExt || getExt(originalName, "webp"));
  const namespace = sanitizeSegment(ctx.namespace || "default");

  const resolvers = {
    UUID: () => uuidV4(),
    YYYY: () => String(now.getFullYear()),
    MM: () => pad2(now.getMonth() + 1),
    DD: () => pad2(now.getDate()),
    hh: () => pad2(now.getHours()),
    mm: () => pad2(now.getMinutes()),
    ss: () => pad2(now.getSeconds()),
    Timestamp: () => String(now.getTime()),
    RAND: (arg) => {
      const n = Number(arg);
      const len = Number.isFinite(n) ? Math.min(Math.max(n, 1), 32) : 6;
      return randAlphaNum(len);
    },
    NAME: () => name,
    EXT: () => ext,
    NAMESPACE: () => namespace,
  };

  // 只替换 ${...}，并且只允许白名单变量
  const out = String(template || "").replace(/\$\{([^}]+)\}/g, (_, expr) => {
    const [rawKey, rawArg] = String(expr).split(":");
    const key = rawKey.trim();

    const fn = resolvers[key];
    if (!fn) return ""; // 未知变量直接清空，避免“用户输入执行代码”的幻想

    const val = fn(rawArg?.trim());
    return sanitizeSegment(val);
  });

  // 最终再清洗一遍，保证整体安全
  const finalName = sanitizeSegment(out).replace(/_+/g, "_");
  return finalName || `${uuidV4()}.${ext}`;
}
