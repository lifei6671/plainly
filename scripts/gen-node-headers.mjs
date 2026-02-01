import fs from "node:fs";
import path from "node:path";

const OUT_DIR = process.env.ASSETS_DIR || "docs";
const outFile = path.join(OUT_DIR, "headers.node.json");

// 你可以在 Node 服务里读取这份 json，然后按 path 匹配设置 Cache-Control
const rules = [
  {pattern: "^/index\\.html$", headers: {"Cache-Control": "no-cache"}},
  {pattern: "^/.*\\.html$", headers: {"Cache-Control": "no-cache"}},
  {pattern: "^/assets/.*$", headers: {"Cache-Control": "public, max-age=31536000, immutable"}},
  {
    pattern: "^/.*\\.(js|css|png|jpg|jpeg|svg|woff2)$",
    headers: {"Cache-Control": "public, max-age=31536000, immutable"},
  },
];

fs.mkdirSync(OUT_DIR, {recursive: true});
fs.writeFileSync(outFile, JSON.stringify(rules, null, 2), "utf8");
console.log(`[postbuild:node] wrote ${outFile}`);
