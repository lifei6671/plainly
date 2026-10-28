declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const describe: any;

jest.mock("mobx-react", () => ({observer: (Component) => Component}));
jest.mock("lodash.throttle", () => (fn) => fn);
const mockDebounce = jest.fn((fn) => {
  let pending = false;
  const debounced: any = jest.fn(() => {
    pending = true;
  });
  debounced.cancel = jest.fn(() => {
    pending = false;
  });
  debounced.flush = jest.fn(() => {
    if (pending) {
      pending = false;
      return fn();
    }
  });
  return debounced;
});

jest.mock("lodash.debounce", () => mockDebounce);

jest.mock("./Sidebar", () => () => null);
jest.mock("../utils/helper", () => ({
  markdownParser: {render: () => "", parse: () => []},
  markdownParserWechat: {render: () => "", parse: () => []},
  updateMathjax: jest.fn(),
}));
jest.mock("../utils/pluginCenter", () => ({mathjax: false, mermaid: false}));
jest.mock("../theme", () => ({resolveThemeHtmlForTemplate: jest.fn((_templateNum, html) => html)}));
jest.mock(
  "mermaid",
  () => ({
    __esModule: true,
    default: {
      initialize: jest.fn(),
      run: jest.fn(),
    },
  }),
  {virtual: true},
);

import MarkdownPreview from "./MarkdownPreview";
import pluginCenter from "../utils/pluginCenter";
import {PLAINLY_MERMAID_CONFIG} from "../utils/mermaidConfig";
import {resolveThemeHtmlForTemplate} from "../theme";

const props = {
  content: {content: ""},
  navbar: {codeNum: 0, templateNum: 0, previewType: "mobile"},
  view: {isImmersiveEditing: false, isPreviewAreaOpen: true},
};

beforeEach(() => {
  jest.clearAllMocks();
  (pluginCenter as any).mermaid = false;
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const createMermaidPreview = (sources: string[]) => {
  const preview = document.createElement("section");
  const nodes = sources.map((source) => {
    const node = document.createElement("pre");
    node.className = "mermaid";
    node.textContent = source;
    preview.appendChild(node);
    return node;
  });
  return {preview, nodes};
};

const setMermaidProps = (instance, content: string, documentUuid = "document-a") => {
  (instance as any).props = {...props, content: {...props.content, content, documentUuid}};
};

const createMermaidRun = () =>
  jest.fn(({nodes}) => {
    nodes.forEach((node, index) => {
      node.innerHTML = `<svg data-rendered-index="${index}">${node.textContent}</svg>`;
      node.setAttribute("data-processed", "true");
    });
  });

it("resolves preview HTML with the navbar template number", () => {
  const instance = new MarkdownPreview({...props, navbar: {...props.navbar, templateNum: 3}});

  instance.render();

  expect(resolveThemeHtmlForTemplate).toHaveBeenCalledWith(3, "");
});

it("typesets math after the mathjax loader finishes", async () => {
  const instance = new MarkdownPreview(props);
  instance.handleUpdateMathjax = jest.fn();
  instance.initMermaid = jest.fn();

  instance.componentDidMount();
  await flushPromises();

  expect(instance.handleUpdateMathjax).toHaveBeenCalled();
});

it("initializes editor Mermaid with the shared Neo config", async () => {
  const instance = new MarkdownPreview(props);

  instance.initMermaid();
  await flushPromises();

  expect(PLAINLY_MERMAID_CONFIG).toEqual({
    theme: "neo",
    look: "neo",
    startOnLoad: false,
    securityLevel: "strict",
    flowchart: {
      htmlLabels: false,
    },
  });
  expect(require("mermaid").default.initialize).toHaveBeenCalledWith(PLAINLY_MERMAID_CONFIG);
  expect((pluginCenter as any).mermaid).toBe(true);
});

it("schedules Mermaid only for preview changes and renders it on blur", () => {
  const instance = new MarkdownPreview(props);
  expect(mockDebounce).toHaveBeenCalledWith(instance.updateMermaid, 800, {leading: false, trailing: true});
  const {
    preview,
    nodes: [node],
  } = createMermaidPreview(["graph TD"]);
  const run = createMermaidRun();
  instance.mermaid = {run};
  instance.previewWrap = preview;
  (pluginCenter as any).mermaid = true;

  instance.componentDidUpdate();
  expect(instance.handleUpdateMermaid).not.toHaveBeenCalled();

  (instance as any).props = {...props, content: {...props.content, content: "```mermaid\ngraph TD\n```"}};
  instance.componentDidUpdate();
  (instance as any).props = {...props, content: {...props.content, content: "```mermaid\ngraph LR\n```"}};
  instance.componentDidUpdate();
  instance.componentDidUpdate();

  expect(instance.handleUpdateMermaid).toHaveBeenCalledTimes(2);
  expect(run).not.toHaveBeenCalled();

  instance.flushMermaid();

  expect((instance.handleUpdateMermaid as any).flush).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith({nodes: [node]});
});

it("restores a cached Mermaid SVG immediately after the preview DOM is rebuilt", () => {
  const instance = new MarkdownPreview(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const source = "graph TD";
  const first = createMermaidPreview([source]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.flushMermaid();
  expect(instance.mermaidCache.size).toBe(1);

  const rebuilt = createMermaidPreview([source]);
  instance.previewWrap = rebuilt.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\nordinary text");
  instance.componentDidUpdate();

  expect(rebuilt.nodes[0].innerHTML).toBe(first.nodes[0].innerHTML);
  expect(rebuilt.nodes[0].getAttribute("data-processed")).toBe("true");
  expect(instance.handleUpdateMermaid).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledTimes(1);
});

it("renders only the changed Mermaid node after restoring unchanged nodes", () => {
  const instance = new MarkdownPreview(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD", "graph LR"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph LR\n```");

  instance.componentDidUpdate();
  instance.flushMermaid();

  const rebuilt = createMermaidPreview(["graph TD", "graph BT"]);
  instance.previewWrap = rebuilt.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph BT\n```");
  instance.componentDidUpdate();

  expect(rebuilt.nodes[0].getAttribute("data-processed")).toBe("true");
  expect(rebuilt.nodes[1].getAttribute("data-processed")).toBe(null);
  instance.flushMermaid();

  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][0]).toEqual({nodes: [rebuilt.nodes[1]]});
  expect(instance.mermaidCache.size).toBe(2);
});

it("does not reuse Mermaid cache entries across document UUIDs", () => {
  const instance = new MarkdownPreview(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-a");

  instance.componentDidUpdate();
  instance.flushMermaid();

  const nextDocument = createMermaidPreview(["graph TD"]);
  instance.previewWrap = nextDocument.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-b");
  instance.componentDidUpdate();

  expect(nextDocument.nodes[0].getAttribute("data-processed")).toBe(null);
  expect(instance.handleUpdateMermaid).toHaveBeenCalledTimes(2);
  instance.flushMermaid();
  expect(run).toHaveBeenCalledTimes(2);
});

it("keeps same-source Mermaid occurrences in separate cache entries", () => {
  const instance = new MarkdownPreview(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD", "graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.flushMermaid();
  expect(instance.mermaidCache.size).toBe(2);

  const rebuilt = createMermaidPreview(["graph TD", "graph TD"]);
  instance.previewWrap = rebuilt.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph TD\n```\nordinary text");
  instance.componentDidUpdate();

  expect(rebuilt.nodes[0].innerHTML).toContain('data-rendered-index="0"');
  expect(rebuilt.nodes[1].innerHTML).toContain('data-rendered-index="1"');
  expect(instance.handleUpdateMermaid).toHaveBeenCalledTimes(1);
});

it("prunes Mermaid cache entries while ordinary text changes rebuild the preview", () => {
  const instance = new MarkdownPreview(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.flushMermaid();

  ["first", "second", "third"].forEach((text) => {
    const rebuilt = createMermaidPreview(["graph TD"]);
    instance.previewWrap = rebuilt.preview;
    setMermaidProps(instance, `\`\`\`mermaid\ngraph TD\n\`\`\`\n${text}`);
    instance.componentDidUpdate();
    expect(instance.mermaidCache.size).toBe(1);
    expect(rebuilt.nodes[0].getAttribute("data-processed")).toBe("true");
  });

  expect(run).toHaveBeenCalledTimes(1);
});

it("does not cache a stale Mermaid Promise after switching documents", async () => {
  const instance = new MarkdownPreview(props);
  let resolveRun;
  const run = jest.fn(({nodes}) => {
    nodes.forEach((node) => {
      node.innerHTML = "<svg />";
      node.setAttribute("data-processed", "true");
    });
    return new Promise((resolve) => {
      resolveRun = resolve;
    });
  });
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-a");

  instance.componentDidUpdate();
  instance.flushMermaid();

  const nextDocument = createMermaidPreview(["graph TD"]);
  instance.previewWrap = nextDocument.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-b");
  instance.componentDidUpdate();
  resolveRun();
  await Promise.resolve();
  await Promise.resolve();

  expect(instance.mermaidCacheDocumentKey).toBe("document-b");
  expect(instance.mermaidCache.size).toBe(0);
});

it("captures Mermaid Promise rejections", async () => {
  const instance = new MarkdownPreview(props);
  const error = new Error("render failed");
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  instance.mermaid = {run: jest.fn(() => Promise.reject(error))};
  (pluginCenter as any).mermaid = true;
  const preview = createMermaidPreview(["graph TD"]);
  instance.previewWrap = preview.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.flushMermaid();
  await Promise.resolve();
  await Promise.resolve();

  expect(consoleError).toHaveBeenCalledWith(error);
  consoleError.mockRestore();
});

it("cancels the pending Mermaid render when unmounted", () => {
  const instance = new MarkdownPreview(props);
  instance.mermaidCache.set("cache-key", "<svg />");

  instance.componentWillUnmount();

  expect((instance.handleUpdateMermaid as any).cancel).toHaveBeenCalledTimes(1);
  expect(instance.mermaidCache.size).toBe(0);
});
