const fs = require("fs");
const path = require("path");

describe("imageHosting source guards", () => {
  it("keeps explicit qiniu config validation and clears loading on sync failures", () => {
    const source = fs.readFileSync(path.join(__dirname, "imageHosting.js"), "utf8");
    const qiniuSectionStart = source.indexOf("export const qiniuOSSUpload");
    const qiniuSectionEnd = source.indexOf("// 用户自定义的图床上传");
    const qiniuSection = source.slice(qiniuSectionStart, qiniuSectionEnd);

    expect(qiniuSection).toContain('throw new Error("请先配置七牛云图床")');
    expect(qiniuSection).toContain("message.destroy();");
    expect(qiniuSection).toContain("uploadError(err.toString());");
  });
});
