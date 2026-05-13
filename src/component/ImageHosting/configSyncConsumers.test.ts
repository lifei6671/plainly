export {};

const fs = require("fs");
const path = require("path");
declare const describe: any;
declare const it: any;
declare const expect: any;

const resolveExistingPath = (...segments) => {
  const tsPath = path.join(
    __dirname,
    ...segments.map((segment) => segment.replace(/\.jsx$/, ".tsx").replace(/\.js$/, ".ts")),
  );
  if (fs.existsSync(tsPath)) {
    return tsPath;
  }
  return path.join(__dirname, ...segments);
};

const consumerFiles = [
  {
    filePath: resolveExistingPath("AliOSS.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: resolveExistingPath("QiniuOSS.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: resolveExistingPath("R2.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: resolveExistingPath("..", "..", "utils", "imageHosting.js"),
    importLine: 'import {resolveHostingConfig} from "../component/ImageHosting/configSync";',
  },
];

describe("image hosting config sync consumers", () => {
  it.each(consumerFiles)("$filePath uses ESM imports for configSync", ({filePath, importLine}) => {
    const source = fs.readFileSync(filePath, "utf8");

    expect(source).toContain(importLine);
    expect(source).not.toContain('require("./configSync")');
    expect(source).not.toContain('require("../component/ImageHosting/configSync")');
  });
});
