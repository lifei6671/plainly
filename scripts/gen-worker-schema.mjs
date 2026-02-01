import fs from "node:fs";
import path from "node:path";

const SOURCE_FILE = path.resolve("src", "data", "store", "schema.ts");
const OUT_FILE = path.resolve("worker", "schema.generated.js");

// 从 schema.ts 提取对象字面量，避免手写重复
const extractObjectLiteral = (source, marker) => {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) {
    throw new Error(`未找到标记: ${marker}`);
  }
  const braceStart = source.indexOf("{", markerIndex);
  if (braceStart === -1) {
    throw new Error(`未找到对象起始 { : ${marker}`);
  }
  let depth = 0;
  let start = -1;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let escape = false;
  for (let i = braceStart; i < source.length; i += 1) {
    const ch = source[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (inSingle) {
      if (ch === "'") inSingle = false;
      continue;
    }
    if (inDouble) {
      if (ch === "\"") inDouble = false;
      continue;
    }
    if (inTemplate) {
      if (ch === "`") inTemplate = false;
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      continue;
    }
    if (ch === "\"") {
      inDouble = true;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) start = i;
      depth += 1;
      continue;
    }
    if (ch === "}") {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`未找到完整对象: ${marker}`);
};

const source = fs.readFileSync(SOURCE_FILE, "utf8");
const tablesLiteral = extractObjectLiteral(source, "export const SQLiteTables");
const ddlLiteral = extractObjectLiteral(source, "export const SQLiteDDL");

const output = `// 本文件由 scripts/gen-worker-schema.mjs 自动生成，请勿手动修改。
export const SQLiteTables = ${tablesLiteral};

export const SQLiteDDL = ${ddlLiteral};
`;

fs.mkdirSync(path.dirname(OUT_FILE), {recursive: true});
fs.writeFileSync(OUT_FILE, output, "utf8");
console.log(`[gen:worker-schema] wrote ${OUT_FILE}`);
