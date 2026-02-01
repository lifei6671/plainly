import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.env.ASSETS_DIR || "docs";
const outFile = path.join(OUT_DIR, "_headers");

// 精准且安全：HTML 不长缓存；静态资源长缓存（若文件名带 hash，配 immutable 非常合适）
const content = `
/index.html
  Cache-Control: no-cache

/*.html
  Cache-Control: no-cache

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*.js
  Cache-Control: public, max-age=31536000, immutable

/*.css
  Cache-Control: public, max-age=31536000, immutable

/*.png
  Cache-Control: public, max-age=31536000, immutable

/*.jpg
  Cache-Control: public, max-age=31536000, immutable

/*.jpeg
  Cache-Control: public, max-age=31536000, immutable

/*.svg
  Cache-Control: public, max-age=31536000, immutable

/*.woff2
  Cache-Control: public, max-age=31536000, immutable
`.trimStart();

fs.mkdirSync(OUT_DIR, {recursive: true});
fs.writeFileSync(outFile, content, "utf8");
console.log(`[postbuild:cf] wrote ${outFile}`);
