/* eslint-disable import/first */
import React from "react";

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock("mobx-react", () => ({
  inject: () => (Comp) => Comp,
  observer: (Comp) => Comp,
}));

jest.mock(
  "@uiw/react-codemirror",
  () =>
    function CodeMirror() {
      return null;
    },
);

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

jest.mock("antd", () => {
  return {
    Button: ({children, ...props}) => React.createElement("button", {...props, type: "button"}, children),
    Tooltip: ({children}) => React.createElement(React.Fragment, null, children),
  };
});

jest.mock(
  "./component/DocumentNavigator",
  () =>
    function DocumentNavigator() {
      return null;
    },
);

jest.mock(
  "./layout/Dialog",
  () =>
    function Dialog() {
      return null;
    },
);

jest.mock(
  "./layout/Navbar",
  () =>
    function Navbar() {
      return null;
    },
);

jest.mock(
  "./layout/Sidebar",
  () =>
    function Sidebar() {
      return null;
    },
);

jest.mock(
  "./layout/StyleEditor",
  () =>
    function StyleEditor() {
      return null;
    },
);

jest.mock(
  "./layout/EditorMenu",
  () =>
    function EditorMenu() {
      return null;
    },
);

jest.mock(
  "./component/SearchBox",
  () =>
    function SearchBox() {
      return null;
    },
);

jest.mock(
  "./component/Auth/AuthModal",
  () =>
    function AuthModal() {
      return null;
    },
);

jest.mock("./utils/helper", () => ({
  countVisibleChars: () => 0,
  markdownParser: {render: () => "", parse: () => []},
  markdownParserWechat: {render: () => "", parse: () => []},
  updateMathjax: jest.fn(),
}));

jest.mock("./utils/pluginCenter", () => ({
  mathjax: false,
  mermaid: false,
}));

jest.mock("./utils/imageHosting", () => ({
  uploadAdaptor: jest.fn(),
}));

jest.mock("./utils/hotkey", () => {
  const bindHotkeys = jest.fn(() => ({}));
  return {
    __esModule: true,
    default: bindHotkeys,
    betterTab: jest.fn(),
    rightClick: jest.fn(),
  };
});

jest.mock("./theme", () => ({
  resolveThemeHtmlForTemplate: jest.fn((_templateNum, html) => html),
}));

jest.mock("./utils/configStore", () => ({
  getConfigSync: jest.fn(() => null),
  setConfigSync: jest.fn(),
}));

jest.mock("./data/store/browser/BrowserDataStore.ts", () => ({
  BrowserDataStore: jest.fn(),
}));

jest.mock("./data/store/index.ts", () => ({
  getDataStore: jest.fn(() => ({
    init: jest.fn(),
    listCategories: jest.fn(() => []),
    listAllDocuments: jest.fn(() => []),
    batchCreateCategories: jest.fn(() => ({items: []})),
    batchCreateDocuments: jest.fn(() => ({items: []})),
    clearRemoteData: jest.fn(),
    setConfig: jest.fn(() => Promise.resolve()),
  })),
}));

jest.mock("./search", () => ({
  markIndexDirty: jest.fn(),
  scheduleIndexRebuild: jest.fn(),
}));

import App from "./App";
import pluginCenter from "./utils/pluginCenter";
import {resolveThemeHtmlForTemplate} from "./theme";
import {BrowserDataStore} from "./data/store/browser/BrowserDataStore";
import {getDataStore} from "./data/store/index";
import {
  ALIOSS_IMAGE_HOSTING,
  QINIUOSS_IMAGE_HOSTING,
  R2_IMAGE_HOSTING,
  SM_MS_TOKEN,
  IMAGE_HOSTING_TYPE,
} from "./utils/constant";

const props = {
  navbar: {
    codeNum: 0,
    previewType: "mobile",
    templateNum: 0,
    isSyncScroll: true,
  },
  view: {
    isEditAreaOpen: true,
    isPreviewAreaOpen: true,
    isStyleEditorOpen: false,
    isImmersiveEditing: false,
    setImmersiveEditing: jest.fn(),
  },
  dialog: {
    isSearchOpen: false,
    setCategoryManageOpen: jest.fn(),
  },
  content: {
    content: "",
    documentName: "未命名.md",
    documentUpdatedAt: 0,
    documentCategoryName: "默认目录",
    setContent: jest.fn(),
    setMarkdownEditor: jest.fn(),
  },
  imageHosting: {
    setHostingUrl: jest.fn(),
    setHostingName: jest.fn(),
    addImageHosting: jest.fn(),
    setType: jest.fn(),
  },
  defaultText: "",
  onTextChange: jest.fn(),
  useImageHosting: {
    url: "",
    name: "",
    isSmmsOpen: false,
    isR2Open: false,
    isQiniuyunOpen: false,
    isAliyunOpen: false,
  },
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

it("falls back to Rico's live ratio when preview headings have no markers", () => {
  const markdownEditor = {
    getScrollInfo: jest.fn(() => ({top: 450, height: 1000, clientHeight: 100})),
    scrollTo: jest.fn(),
  };
  const instance = new App({...props, content: {...props.content, markdownEditor}});
  instance.previewContainer = {scrollTop: 0, scrollHeight: 2000, clientHeight: 100} as HTMLDivElement;

  instance.handleEditorScroll();
  expect(instance.previewContainer.scrollTop).toBe(950);

  Object.defineProperty(instance.previewContainer, "scrollHeight", {configurable: true, value: 5000});
  instance.handleEditorScroll();
  expect(instance.previewContainer.scrollTop).toBe(2450);
});

it("uses live heading anchors when the preview has semantic positions", () => {
  const markdownEditor = {
    getScrollInfo: jest.fn(() => ({top: 2900, height: 4000, clientHeight: 100})),
    heightAtLine: jest.fn((line) => ({100: 100, 1500: 1500, 2900: 2900, 3000: 3000, 3100: 3100}[line] || 0)),
    lineCount: jest.fn(() => 3200),
    scrollTo: jest.fn(),
  };
  const instance = new App({...props, content: {...props.content, markdownEditor}});
  const preview = {scrollTop: 0, scrollHeight: 50000, clientHeight: 100} as HTMLDivElement;
  const previewRoot = document.createElement("section");
  const headingPositions = [
    [100, 700],
    [1500, 12000],
    [2900, 35000],
    [3000, 36500],
    [3100, 38000],
  ];
  preview.getBoundingClientRect = () => ({top: 0, height: 100} as DOMRect);
  headingPositions.forEach(([line, top]) => {
    const heading = document.createElement("h2");
    heading.setAttribute("data-scroll-source-line", String(line));
    heading.getBoundingClientRect = () => ({top: top - preview.scrollTop, height: 30} as DOMRect);
    previewRoot.appendChild(heading);
  });
  instance.previewContainer = preview;
  instance.previewWrap = previewRoot;

  instance.handleEditorScroll();
  expect(preview.scrollTop).toBe(35000);

  instance.syncScrollLock = null;
  preview.scrollTop = 38000;
  instance.handlePreviewScroll();
  expect(markdownEditor.scrollTo).toHaveBeenCalledWith(null, 3100);
});

it("synchronizes preview scroll to CodeMirror using the editor's current range", () => {
  const markdownEditor = {
    getScrollInfo: jest.fn(() => ({top: 0, height: 1000, clientHeight: 100})),
    scrollTo: jest.fn(),
  };
  const instance = new App({...props, content: {...props.content, markdownEditor}});
  instance.previewContainer = {scrollTop: 1000, scrollHeight: 2100, clientHeight: 100} as HTMLDivElement;

  instance.handlePreviewScroll();

  expect(markdownEditor.scrollTo).toHaveBeenCalledWith(null, 450);
});

it("prevents a programmatic scroll event from feeding back and releases on the next frame", () => {
  const markdownEditor = {
    getScrollInfo: jest.fn(() => ({top: 450, height: 1000, clientHeight: 100})),
    scrollTo: jest.fn(),
  };
  const windowAny = window as any;
  const originalRequestAnimationFrame = windowAny.requestAnimationFrame;
  const frames: FrameRequestCallback[] = [];
  windowAny.requestAnimationFrame = jest.fn((callback) => {
    frames.push(callback);
    return frames.length;
  });
  const instance = new App({...props, content: {...props.content, markdownEditor}});
  instance.previewContainer = {scrollTop: 0, scrollHeight: 2100, clientHeight: 100} as HTMLDivElement;

  instance.handleEditorScroll();
  instance.handlePreviewScroll();
  expect(markdownEditor.scrollTo).not.toHaveBeenCalled();

  frames.shift()(0);
  instance.previewContainer.scrollTop = 1000;
  instance.handlePreviewScroll();
  expect(markdownEditor.scrollTo).toHaveBeenCalledWith(null, 450);

  windowAny.requestAnimationFrame = originalRequestAnimationFrame;
});

it("does not synchronize when sync scrolling is disabled", () => {
  const markdownEditor = {
    getScrollInfo: jest.fn(() => ({top: 450, height: 1000, clientHeight: 100})),
    scrollTo: jest.fn(),
  };
  const instance = new App({...props, navbar: {...props.navbar, isSyncScroll: false}, content: {...props.content, markdownEditor}});
  instance.previewContainer = {scrollTop: 10, scrollHeight: 2100, clientHeight: 100} as HTMLDivElement;

  instance.handleEditorScroll();
  instance.handlePreviewScroll();

  expect(instance.previewContainer.scrollTop).toBe(10);
  expect(markdownEditor.scrollTo).not.toHaveBeenCalled();
});

it("renders without crashing with injected props", () => {
  const instance = new App(props);
  expect(() => instance.render()).not.toThrow();
  expect(instance.render()).toBeTruthy();
});

const renderAppContent = (instance) => instance.render().props.children({defaultTitle: ""});

const findDocumentNavigatorButtonCount = (node) => {
  if (!node || typeof node !== "object") return 0;
  const ownCount = node.props?.["aria-label"] === "文档导航" ? 1 : 0;
  const children = node.props?.children;
  if (Array.isArray(children)) {
    return ownCount + children.reduce((count, child) => count + findDocumentNavigatorButtonCount(child), 0);
  }
  return ownCount + findDocumentNavigatorButtonCount(children);
};

it("shows the document navigator entry in local and remote status states", () => {
  const offline = new App(props);
  offline.isRemoteMode = false;
  expect(findDocumentNavigatorButtonCount(renderAppContent(offline))).toBe(1);

  const remoteAnonymous = new App(props);
  remoteAnonymous.isRemoteMode = true;
  expect(findDocumentNavigatorButtonCount(renderAppContent(remoteAnonymous))).toBe(1);

  const remoteAuthenticated = new App(props);
  remoteAuthenticated.isRemoteMode = true;
  remoteAuthenticated.state = {...remoteAuthenticated.state, currentUser: {id: 7, account: "demo"}};
  expect(findDocumentNavigatorButtonCount(renderAppContent(remoteAuthenticated))).toBe(1);
});

it("adds the pinned class after the navigator callback", () => {
  const instance = new App(props);
  instance.setState = jest.fn((updater) => {
    const next = typeof updater === "function" ? updater(instance.state, instance.props) : updater;
    instance.state = {...instance.state, ...next};
  });

  instance.handleDocumentNavigatorPinnedChange(true);

  expect(renderAppContent(instance).props.className).toContain("nice-document-navigator-pinned");
});

it("resolves preview HTML with the navbar template number", () => {
  const instance = new App({...props, navbar: {...props.navbar, templateNum: 3}});

  instance.render();

  expect(resolveThemeHtmlForTemplate).toHaveBeenCalledWith(3, "");
});

it("typesets math after the mathjax loader finishes", async () => {
  const instance = new App(props);
  instance.handleUpdateMathjax = jest.fn();
  instance.initMermaid = jest.fn();
  instance.setCustomImageHosting = jest.fn();
  instance.loadCurrentUser = jest.fn();
  instance.setEditorContent = jest.fn();

  instance.componentDidMount();
  await flushPromises();

  expect(instance.handleUpdateMathjax).toHaveBeenCalled();
});

it("schedules Mermaid only for preview changes and renders it on blur", () => {
  const instance = new App(props);
  expect(mockDebounce).toHaveBeenCalledWith(instance.updateMermaid, 800, {leading: false, trailing: true});
  const {preview, nodes: [node]} = createMermaidPreview(["graph TD"]);
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

  instance.handleBlur();

  expect((instance.handleUpdateMermaid as any).flush).toHaveBeenCalledTimes(1);
  expect(run).toHaveBeenCalledWith({nodes: [node]});
});

it("restores a cached Mermaid SVG immediately after the preview DOM is rebuilt", () => {
  const instance = new App(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const source = "graph TD";
  const first = createMermaidPreview([source]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.handleBlur();
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
  const instance = new App(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD", "graph LR"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph LR\n```");

  instance.componentDidUpdate();
  instance.handleBlur();

  const rebuilt = createMermaidPreview(["graph TD", "graph BT"]);
  instance.previewWrap = rebuilt.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph BT\n```");
  instance.componentDidUpdate();

  expect(rebuilt.nodes[0].getAttribute("data-processed")).toBe("true");
  expect(rebuilt.nodes[1].getAttribute("data-processed")).toBe(null);
  instance.handleBlur();

  expect(run).toHaveBeenCalledTimes(2);
  expect(run.mock.calls[1][0]).toEqual({nodes: [rebuilt.nodes[1]]});
  expect(instance.mermaidCache.size).toBe(2);
});

it("does not reuse Mermaid cache entries across document UUIDs", () => {
  const instance = new App(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-a");

  instance.componentDidUpdate();
  instance.handleBlur();

  const nextDocument = createMermaidPreview(["graph TD"]);
  instance.previewWrap = nextDocument.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```", "document-b");
  instance.componentDidUpdate();

  expect(nextDocument.nodes[0].getAttribute("data-processed")).toBe(null);
  expect(instance.handleUpdateMermaid).toHaveBeenCalledTimes(2);
  instance.handleBlur();
  expect(run).toHaveBeenCalledTimes(2);
});

it("keeps same-source Mermaid occurrences in separate cache entries", () => {
  const instance = new App(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD", "graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```\n```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.handleBlur();
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
  const instance = new App(props);
  const run = createMermaidRun();
  instance.mermaid = {run};
  (pluginCenter as any).mermaid = true;
  const first = createMermaidPreview(["graph TD"]);
  instance.previewWrap = first.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.handleBlur();

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
  const instance = new App(props);
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
  instance.handleBlur();

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
  const instance = new App(props);
  const error = new Error("render failed");
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => undefined);
  instance.mermaid = {run: jest.fn(() => Promise.reject(error))};
  (pluginCenter as any).mermaid = true;
  const preview = createMermaidPreview(["graph TD"]);
  instance.previewWrap = preview.preview;
  setMermaidProps(instance, "```mermaid\ngraph TD\n```");

  instance.componentDidUpdate();
  instance.handleBlur();
  await Promise.resolve();
  await Promise.resolve();

  expect(consoleError).toHaveBeenCalledWith(error);
  consoleError.mockRestore();
});

it("cancels the pending Mermaid render when unmounted", () => {
  const instance = new App(props);
  instance.mermaidCache.set("cache-key", "<svg />");

  instance.componentWillUnmount();

  expect((instance.handleUpdateMermaid as any).cancel).toHaveBeenCalledTimes(1);
  expect(instance.mermaidCache.size).toBe(0);
});

it("syncs local data after restoring an existing session", async () => {
  const instance = new App(props);
  const restoredUser = {id: 7, account: "restored", username: "restored"};

  instance.isRemoteMode = true;
  instance.setState = jest.fn((updater) => {
    const nextState = typeof updater === "function" ? updater(instance.state, instance.props) : updater;
    instance.state = {...instance.state, ...nextState};
  });
  Object.defineProperty(document, "cookie", {
    configurable: true,
    value: "plainly_session=1",
  });
  instance.apiRequest = jest.fn().mockResolvedValue({
    user: {id: 7, account: "restored"},
  });
  instance.syncLocalToRemote = jest.fn().mockResolvedValue(undefined);

  await instance.loadCurrentUser();

  expect(instance.apiRequest).toHaveBeenCalledWith("/auth/refresh", "POST");
  expect(instance.state.currentUser).toEqual(restoredUser);
  expect(instance.syncLocalToRemote).toHaveBeenCalledWith(restoredUser);
});

it("keeps restored session when local sync fails", async () => {
  const instance = new App(props);
  const restoredUser = {id: 7, account: "restored", username: "restored"};

  instance.isRemoteMode = true;
  instance.setState = jest.fn((updater) => {
    const nextState = typeof updater === "function" ? updater(instance.state, instance.props) : updater;
    instance.state = {...instance.state, ...nextState};
  });
  Object.defineProperty(document, "cookie", {
    configurable: true,
    value: "plainly_session=1",
  });
  instance.apiRequest = jest.fn().mockResolvedValue({
    user: {id: 7, account: "restored"},
  });
  instance.syncLocalToRemote = jest.fn().mockRejectedValue(new Error("sync failed"));
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

  await instance.loadCurrentUser();

  expect(instance.state.currentUser).toEqual(restoredUser);
  expect(instance.syncLocalToRemote).toHaveBeenCalledWith(restoredUser);
  consoleError.mockRestore();
});

it("syncs image hosting config to remote store after login", async () => {
  const localStore = {
    init: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn((key) => {
      const values = {
        [ALIOSS_IMAGE_HOSTING]: {bucket: "ali-bucket"},
        [QINIUOSS_IMAGE_HOSTING]: {bucket: "qiniu-bucket"},
        [R2_IMAGE_HOSTING]: {bucket: "r2-bucket"},
        [SM_MS_TOKEN]: "smms-token",
        [IMAGE_HOSTING_TYPE]: "CF R2",
      };
      return Promise.resolve(values[key] ?? null);
    }),
    listCategories: jest.fn().mockResolvedValue([]),
    listAllDocuments: jest.fn().mockResolvedValue([]),
  };
  const remoteStore = {
    setConfig: jest.fn().mockResolvedValue(undefined),
    batchCreateCategories: jest.fn().mockResolvedValue({items: []}),
    batchCreateDocuments: jest.fn().mockResolvedValue({items: []}),
  };
  (BrowserDataStore as any).mockImplementation(() => localStore);
  (getDataStore as any).mockReturnValue(remoteStore);
  const instance = new App(props);
  instance.isRemoteMode = true;

  await instance.syncLocalToRemote({id: 7, account: "demo", username: "demo"});

  expect(remoteStore.setConfig).toHaveBeenCalledWith(ALIOSS_IMAGE_HOSTING, {bucket: "ali-bucket"});
  expect(remoteStore.setConfig).toHaveBeenCalledWith(QINIUOSS_IMAGE_HOSTING, {bucket: "qiniu-bucket"});
  expect(remoteStore.setConfig).toHaveBeenCalledWith(R2_IMAGE_HOSTING, {bucket: "r2-bucket"});
  expect(remoteStore.setConfig).toHaveBeenCalledWith(SM_MS_TOKEN, "smms-token");
  expect(remoteStore.setConfig).toHaveBeenCalledWith(IMAGE_HOSTING_TYPE, "CF R2");
});

it("continues syncing categories and documents when image hosting config sync fails", async () => {
  const localStore = {
    init: jest.fn().mockResolvedValue(undefined),
    getConfig: jest.fn((key) => {
      if (key === ALIOSS_IMAGE_HOSTING) {
        return Promise.resolve({bucket: "ali-bucket"});
      }
      return Promise.resolve(null);
    }),
    listCategories: jest.fn().mockResolvedValue([
      {
        category_id: "cat-1",
        name: "默认分类",
        version: 1,
      },
    ]),
    listAllDocuments: jest.fn().mockResolvedValue([
      {
        document_id: "doc-1",
        name: "示例文档",
        category_id: "cat-1",
        createdAt: 1,
        updatedAt: 2,
        charCount: 3,
        version: 1,
      },
    ]),
    getDocumentContent: jest.fn().mockResolvedValue("# hello"),
    remapCategoryUuid: jest.fn().mockResolvedValue(undefined),
    remapDocumentUuid: jest.fn().mockResolvedValue(undefined),
  };
  const remoteStore = {
    setConfig: jest.fn().mockRejectedValue(new Error("config failed")),
    batchCreateCategories: jest.fn().mockResolvedValue({
      items: [{client_id: "cat-1", category: {category_id: "remote-cat-1", name: "默认分类"}}],
    }),
    batchCreateDocuments: jest.fn().mockResolvedValue({
      items: [{client_id: "doc-1", document: {document_id: "remote-doc-1"}}],
    }),
  };
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  (BrowserDataStore as any).mockImplementation(() => localStore);
  (getDataStore as any).mockReturnValue(remoteStore);
  const instance = new App(props);
  instance.isRemoteMode = true;

  await instance.syncLocalToRemote({id: 7, account: "demo", username: "demo"});

  expect(remoteStore.setConfig).toHaveBeenCalledWith(ALIOSS_IMAGE_HOSTING, {bucket: "ali-bucket"});
  expect(remoteStore.batchCreateCategories).toHaveBeenCalled();
  expect(remoteStore.batchCreateDocuments).toHaveBeenCalledWith([
    {
      meta: {
        document_id: "doc-1",
        name: "示例文档",
        category_id: "remote-cat-1",
        createdAt: 1,
        updatedAt: 2,
        charCount: 3,
        source: "local",
        version: 1,
      },
      content: "# hello",
    },
  ]);
  consoleError.mockRestore();
});
