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

  it("keeps mathjax svg markup for SSR formulas", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <section class="inline-equation">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g>
            <path d="M0 0H24V24H0Z" fill="none" stroke="#333" stroke-width="2"></path>
          </g>
        </svg>
      </section>
    `);

    expect(result.html).toContain("<svg");
    expect(result.html).toContain('viewBox="0 0 24 24"');
    expect(result.html).toContain("<path");
    expect(result.html).not.toContain("<math");
    expect(result.html).not.toContain("<script");
  });

  it("keeps safe svg camelCase attributes after sanitization", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg viewBox="0 0 100 40" preserveAspectRatio="xMidYMid meet">
        <defs>
          <clipPath id="clip-a" clipPathUnits="userSpaceOnUse">
            <rect x="0" y="0" width="100" height="40"></rect>
          </clipPath>
          <linearGradient id="grad-a" gradientTransform="rotate(45)">
            <stop offset="0%" stop-color="#fff"></stop>
          </linearGradient>
        </defs>
      </svg>
    `);

    expect(result.html).toContain('preserveAspectRatio="xMidYMid meet"');
    expect(result.html).toContain('clipPathUnits="userSpaceOnUse"');
    expect(result.html).toContain('gradientTransform="rotate(45)"');
  });

  it("keeps mermaid svg structures such as foreignObject labels", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg viewBox="0 0 100 40">
        <defs><clipPath id="clip-a"><rect x="0" y="0" width="100" height="40"></rect></clipPath></defs>
        <g clip-path="url(#clip-a)">
          <foreignObject x="0" y="0" width="100" height="40">
            <div xmlns="http://www.w3.org/1999/xhtml" class="label" style="display:inline-block;white-space:nowrap">
              <span class="nodeLabel">流程节点</span>
            </div>
          </foreignObject>
        </g>
      </svg>
    `);

    expect(result.html).toContain("<svg");
    expect(result.html).toContain("<clipPath");
    expect(result.html).toContain("<foreignObject");
    expect(result.html).toContain('xmlns="http://www.w3.org/1999/xhtml"');
    expect(result.html).toContain("display: inline-block");
    expect(result.html).toContain("white-space: nowrap");
    expect(result.html).toContain("流程节点");
  });

  it("keeps safe mermaid svg style blocks and strips unsafe style blocks", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg id="mermaid-test" viewBox="0 0 100 40">
        <style>
          #mermaid-test .nodeLabel { display: inline-block; line-height: 1.2; }
          #mermaid-test .edgeLabel { background-color: #e8e8e8; text-align: center; }
        </style>
        <foreignObject x="0" y="0" width="100" height="40">
          <div class="nodeLabel">Get money</div>
        </foreignObject>
      </svg>
      <style>body { background-image: url(javascript:alert(1)); }</style>
    `);

    expect(result.html).toContain("<style>");
    expect(result.html).toContain("#mermaid-test .nodeLabel");
    expect(result.html).toContain("Get money");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("background-image");
  });

  it("keeps mermaid self-closing svg elements from swallowing following labels", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg id="mermaid-test" viewBox="0 0 120 40">
        <g class="edgePaths">
          <path d="M0 0L10 10" class="flowchart-link" />
          <path d="M10 10L20 20" class="flowchart-link" />
        </g>
        <g class="node">
          <rect class="basic label-container" x="0" y="0" width="80" height="24" />
          <text><tspan x="0" dy="1em">Christmas</tspan></text>
        </g>
      </svg>
    `);
    const container = document.createElement("div");
    container.innerHTML = result.html;

    expect(container.querySelector("path path")).toBeNull();
    expect(container.querySelector("rect text")).toBeNull();
    expect(container.querySelectorAll(".edgePaths > path")).toHaveLength(2);
    expect(container.querySelector(".node > text")?.textContent).toContain("Christmas");
  });

  it("keeps mermaid inline font-family styles with escaped quotes intact", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg id="mermaid-test" viewBox="0 0 120 40">
        <text style="font-family:&quot;trebuchet ms&quot;, verdana, arial, sans-serif;font-size:16px;fill:rgb(51, 51, 51)">
          Christmas
        </text>
      </svg>
    `);

    expect(result.html).toContain("font-family: &quot;trebuchet ms&quot;, verdana, arial, sans-serif");
    expect(result.html).toContain("font-size: 16px");
    expect(result.html).not.toContain("font-family: &amp;quot");
  });

  it("sanitizes complete mermaid svg subtrees without html tag rewriting", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <section>
        <svg id="mermaid-test" viewBox="0 0 120 40" aria-roledescription="flowchart-v2">
          <g class="edgePaths">
            <path d="M0 0L10 10" class="flowchart-link"></path><path d="M10 10L20 20" class="flowchart-link"></path>
          </g>
          <g class="node" data-node="true">
            <rect class="basic label-container" x="0" y="0" width="80" height="24"></rect><text><tspan xml:space="preserve" x="0" dy="1em">Christmas</tspan></text>
          </g>
          <script>alert(1)</script>
          <g onclick="alert(1)"><text>unsafe</text></g>
        </svg>
      </section>
    `);
    const container = document.createElement("div");
    container.innerHTML = result.html;

    expect(container.querySelector("path path")).toBeNull();
    expect(container.querySelector("rect text")).toBeNull();
    expect(container.querySelectorAll(".edgePaths > path")).toHaveLength(2);
    expect(container.querySelector(".node")?.getAttribute("data-node")).toBe("true");
    expect(container.querySelector("svg")?.getAttribute("aria-roledescription")).toBe("flowchart-v2");
    expect(container.querySelector("tspan")?.getAttribute("xml:space")).toBe("preserve");
    expect(result.html).not.toContain("<script");
    expect(result.html).not.toContain("onclick");
  });

  it("sanitizes html embedded in svg foreignObject through the normal allowlist", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg viewBox="0 0 120 40">
        <foreignObject width="120" height="40">
          <div onclick="alert(1)" style="position:fixed;top:0;color:red">
            <iframe src="https://evil.example"></iframe>
            <p style="color:red">Safe label</p>
          </div>
        </foreignObject>
      </svg>
    `);

    expect(result.html).toContain("<foreignObject");
    expect(result.html).toContain("Safe label");
    expect(result.html).toContain("color: red");
    expect(result.html).not.toContain("onclick");
    expect(result.html).not.toContain("position:fixed");
    expect(result.html).not.toContain("position: fixed");
    expect(result.html).not.toContain("<iframe");
  });

  it("only keeps local fragment references in svg url attributes", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <svg viewBox="0 0 120 40">
        <defs><clipPath id="safeClip"><rect width="10" height="10"></rect></clipPath></defs>
        <g clip-path="url(https://evil.example/clip.svg#x)" marker-end="url(javascript:alert(1))">
          <path d="M0 0L10 10" fill="url(data:image/svg+xml;base64,AAAA)" stroke="url(#safeClip)"></path>
        </g>
      </svg>
    `);

    expect(result.html).toContain('stroke="url(#safeClip)"');
    expect(result.html).not.toContain("https://evil.example");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("data:image");
    expect(result.html).not.toContain("clip-path=");
    expect(result.html).not.toContain("marker-end=");
    expect(result.html).not.toContain("fill=");
  });

  it("keeps allowed data image sources on normal img tags", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <p><img alt="inline" src="data:image/png;base64,AAAA" width="10" height="10"></p>
    `);

    expect(result.html).toContain('<img alt="inline" src="data:image/png;base64,AAAA" width="10" height="10" />');
    expect(result.stats.blockedUrls).toBe(0);
  });

  it("keeps safe code block header background images while stripping javascript urls", async () => {
    const result = await sanitizeShareHtmlByStringRules(`
      <pre class="custom">
        <span style="display:block;background:url(https://s2.loli.net/2022/01/11/XyHnMBGWCl5Z9DK.png);height:30px;background-size:40px"></span>
        <span style="display:block;background-image:url(javascript:alert(1));height:30px"></span>
        <code class="hljs" style="display:block;background:#272822;color:#ddd;padding:16px">{role}</code>
      </pre>
    `);

    expect(result.html).toContain("background: url(https://s2.loli.net/2022/01/11/XyHnMBGWCl5Z9DK.png)");
    expect(result.html).toContain("height: 30px");
    expect(result.html).toContain("background-size: 40px");
    expect(result.html).toContain("background: #272822");
    expect(result.html).not.toContain("javascript:");
    expect(result.html).not.toContain("background-image");
  });
});
