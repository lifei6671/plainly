const fs = require("fs");
const path = require("path");

const consumerFiles = [
  {
    filePath: path.join(__dirname, "AliOSS.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: path.join(__dirname, "QiniuOSS.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: path.join(__dirname, "R2.jsx"),
    importLine: 'import {loadHostingConfig, persistHostingConfig} from "./configSync";',
  },
  {
    filePath: path.join(__dirname, "..", "..", "utils", "imageHosting.js"),
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
