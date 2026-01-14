const fs = require("node:fs");
const path = require("node:path");

const src = path.resolve("node_modules/jieba-wasm/pkg/web/jieba_rs_wasm_bg.wasm");
const dstDir = path.resolve("src/assets/wasm");
const dst = path.join(dstDir, "jieba_rs_wasm_bg.wasm");

if (!fs.existsSync(src)) {
  console.error("[copy-wasm] Source wasm not found:", src);
  process.exit(1);
}

fs.mkdirSync(dstDir, {recursive: true});
fs.copyFileSync(src, dst);

console.log("[copy-wasm] OK:", dst);
