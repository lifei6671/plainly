import {ricoElementMapToCss} from "../adapters/ricoThemeAdapter";

declare const describe: any;
declare const it: any;
declare const expect: any;

describe("ricoElementMapToCss", () => {
  it("maps container to #nice and preserves every declaration", () => {
    expect(ricoElementMapToCss({container: "color: red; line-height: 1.8;"})).toContain(
      "#nice { color: red; line-height: 1.8; }",
    );
  });

  it("scopes normal and compound selectors without changing pseudos", () => {
    const css = ricoElementMapToCss({h2: "color: navy;", "tbody tr:nth-child(even)": "background: #eee;", "blockquote p": "margin: 0;"});
    expect(css).toContain("#nice h2 { color: navy; }");
    expect(css).toContain("#nice tbody tr:nth-child(even) { background: #eee; }");
    expect(css).toContain("#nice blockquote p { margin: 0; }");
  });

  it("applies list declarations to Plainly's li > section content", () => {
    const css = ricoElementMapToCss({li: "color: red; line-height: 2;", "li p": "font-size: 18px;"});
    expect(css).toContain("#nice li, #nice li > section { color: red; line-height: 2; }");
    expect(css).toContain("#nice li p, #nice li > section p, #nice li > section { font-size: 18px; }");
  });

  it("overrides BASIC_THEME's nested paragraph and table selectors without changing Rico declarations", () => {
    const css = ricoElementMapToCss({p: "color: red;", strong: "color: navy;", tr: "border: none;", th: "background: navy;", td: "padding: 8px;"});

    expect(css).toContain("#nice p, #nice li p, #nice li > section p, #nice blockquote p, #nice td p, #nice th p { color: red; }");
    expect(css).toContain("#nice strong, #nice em strong { color: navy; }");
    expect(css).toContain("#nice tr, #nice table tr, #nice table tr:nth-child(2n) { border: none; }");
    expect(css).toContain("#nice th, #nice table tr th { background: navy; }");
    expect(css).toContain("#nice td, #nice table tr td { padding: 8px; }");
  });

  it("keeps code styling inline and excludes pre so the Code Theme remains responsible for fenced code", () => {
    const css = ricoElementMapToCss({code: "background: #eee;", pre: "padding: 10px;"});
    expect(css).toContain("#nice p code, #nice li code, #nice li > section code, #nice blockquote code, #nice td code, #nice th code { background: #eee; }");
    expect(css).not.toContain("#nice pre");
    expect(css).not.toContain("#nice code { background: #eee; }");
  });

  it("safely scopes unknown selectors instead of dropping or leaking them", () => {
    const css = ricoElementMapToCss({"article > figure .caption": "display: block;", "a:hover": "color: green;"});
    expect(css).toContain("#nice article > figure .caption { display: block; }");
    expect(css).toContain("#nice a:hover { color: green; }");
    expect(css).not.toMatch(/(^|\n)(?!#nice )[^{\n]+\{/);
  });
});
