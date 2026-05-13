// @ts-nocheck
import type {} from "node:fs";
"use strict";

const ts = require("typescript");

const compilerOptions = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2020,
  jsx: ts.JsxEmit.React,
  allowJs: true,
  esModuleInterop: true,
  allowSyntheticDefaultImports: true,
  experimentalDecorators: true,
  useDefineForClassFields: false,
};

function normalizeImportMetaEnv(src) {
  return src
    .replace(
      /typeof\s+import\.meta\s*!==\s*['"]undefined['"]/g,
      'typeof globalThis.__IMPORT_META_ENV__ !== "undefined"',
    )
    .replace(
      /typeof\s+\(import\.meta\s+as\s+any\)\?\.env\?\.([A-Z0-9_]+)\s*!==\s*['"]undefined['"]/g,
      'typeof globalThis.__IMPORT_META_ENV__?.$1 !== "undefined"',
    )
    .replace(/\(import\.meta\s+as\s+any\)\.env/g, "globalThis.__IMPORT_META_ENV__")
    .replace(/import\.meta\.env/g, "globalThis.__IMPORT_META_ENV__");
}

module.exports = {
  process(src, filename) {
    const output = ts.transpileModule(normalizeImportMetaEnv(src), {
      compilerOptions,
      fileName: filename,
      reportDiagnostics: false,
    });

    return output.outputText;
  },
};
