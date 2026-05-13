// @ts-nocheck
import type {} from "node:fs";
"use strict";

const path = require("node:path");
const {execFileSync} = require("node:child_process");
const fs = require("fs-extra");

const projectRoot = path.resolve(__dirname, "..");
const srcDir = path.join(projectRoot, "src");
const outDir = path.join(projectRoot, "lib");
const tsconfigPath = path.join(projectRoot, "tsconfig.lib.json");

const codeExtensions = new Set([".js", ".jsx", ".ts", ".tsx"]);

function run(command, args) {
  execFileSync(command, args, {
    cwd: projectRoot,
    stdio: "inherit",
  });
}

function shouldCopyAsset(filePath) {
  if (filePath.endsWith(".d.ts")) {
    return true;
  }
  if (filePath.endsWith(".test.js") || filePath.endsWith(".test.jsx") || filePath.endsWith(".test.ts") || filePath.endsWith(".test.tsx")) {
    return false;
  }
  return !codeExtensions.has(path.extname(filePath));
}

async function copyAssets(currentDir = srcDir) {
  const entries = await fs.readdir(currentDir, {withFileTypes: true});
  for (const entry of entries) {
    const fromPath = path.join(currentDir, entry.name);
    const relativePath = path.relative(srcDir, fromPath);
    const toPath = path.join(outDir, relativePath);

    if (entry.isDirectory()) {
      await copyAssets(fromPath);
      continue;
    }

    if (!shouldCopyAsset(fromPath)) {
      continue;
    }

    await fs.ensureDir(path.dirname(toPath));
    await fs.copyFile(fromPath, toPath);
  }
}

async function main() {
  await fs.remove(outDir);
  await fs.ensureDir(outDir);

  run(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", tsconfigPath]);
  await copyAssets();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
