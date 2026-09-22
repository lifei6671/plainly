import {execFileSync} from "child_process";
import {readFileSync} from "fs";
import {createRequire} from "module";
import {join} from "path";
import {pathToFileURL} from "url";
import MarkdownIt from "markdown-it";
import markdownItMermaid from "./markdown-it-mermaid";

declare const it: any;
declare const expect: any;

const legacyFlowchart = `graph TD
  A[Start] --> B{Ready?}
  B -- Yes --> C[Continue]
  B -- No --> D[Retry]
  D --> B`;

const sequenceWithMultipleElseBranchesAndNestedLoop = `sequenceDiagram
  participant Client
  participant API
  Client->>API: request
  alt first condition
    API-->>Client: first response
  else second condition
    loop retry until ready
      API->>API: retry work
    end
    API-->>Client: second response
  else final condition
    API-->>Client: fallback response
  end`;

const resolveTestModule = (name: string): string => {
  const moduleRoot = process.env.PLAINLY_MERMAID_TEST_MODULES;
  return createRequire(moduleRoot ? join(moduleRoot, "package.json") : __filename).resolve(name);
};

it("preserves and parses existing flowchart and complex sequence diagram syntax for Mermaid 11", async () => {
  const parser = new MarkdownIt().use(markdownItMermaid);
  const root = document.createElement("div");
  root.innerHTML = parser.render(`\`\`\`mermaid
${legacyFlowchart}
\`\`\`

\`\`\`mermaid
${sequenceWithMultipleElseBranchesAndNestedLoop}
\`\`\``);

  expect(Array.from(root.querySelectorAll(".mermaid")).map((node) => node.textContent)).toEqual([
    legacyFlowchart,
    sequenceWithMultipleElseBranchesAndNestedLoop,
  ]);

  const jsdomUrl = pathToFileURL(resolveTestModule("jsdom")).href;
  const mermaidUrl = pathToFileURL(resolveTestModule("mermaid")).href;
  const mermaidPackage = JSON.parse(readFileSync(resolveTestModule("mermaid/package.json"), "utf8"));
  expect(mermaidPackage.version).toBe("11.17.2");
  const script = `
    import {JSDOM} from ${JSON.stringify(jsdomUrl)};

    const {window} = new JSDOM("<!doctype html><html><body></body></html>");
    globalThis.window = window;
    globalThis.document = window.document;
    Object.defineProperty(globalThis, "navigator", {configurable: true, value: window.navigator});

    const {default: mermaid} = await import(${JSON.stringify(mermaidUrl)});
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: "strict",
      flowchart: {htmlLabels: false},
    });

    await mermaid.parse(${JSON.stringify(legacyFlowchart)});
    await mermaid.parse(${JSON.stringify(sequenceWithMultipleElseBranchesAndNestedLoop)});
  `;

  expect(() => execFileSync(process.execPath, ["--input-type=module", "--eval", script], {stdio: "pipe"})).not.toThrow();
});
