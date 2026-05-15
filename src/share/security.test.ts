declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void | Promise<void>) => void;
declare const expect: any;

export {};

const {sanitizeShareHtmlByStringRules} = require("./security");

describe("share html sanitization", () => {
  it("preserves safe preview ids and inline styles while stripping dangerous content", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <div id="nice-rich-text-box" style="max-width:100%;background-color:#fff;position:fixed">
        <section id="nice" style="color:#222;font-size:18px;background-image:url(javascript:alert(1))" onclick="alert(1)">
          <h1 style="line-height:1.8;text-align:center;expression(alert(1))">预览标题</h1>
        </section>
        <script>alert(1)</script>
      </div>
    `);

    expect(result.html).toContain('id="nice-rich-text-box"');
    expect(result.html).toContain('id="nice"');
    expect(result.html).toContain('style="max-width: 100%; background-color: #fff"');
    expect(result.html).toContain('style="color: #222; font-size: 18px"');
    expect(result.html).toContain('style="line-height: 1.8; text-align: center"');
    expect(result.html).not.toContain("position:fixed");
    expect(result.html).not.toContain("background-image");
    expect(result.html).not.toContain("expression(");
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("<script");
  });
});
