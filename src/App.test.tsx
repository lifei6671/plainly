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

jest.mock("antd", () => {
  return {
    Button: ({children, ...props}) => React.createElement("button", {...props, type: "button"}, children),
  };
});

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
  markdownParser: {render: () => ""},
  markdownParserWechat: {render: () => ""},
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
});

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

it("renders without crashing with injected props", () => {
  const instance = new App(props);
  expect(() => instance.render()).not.toThrow();
  expect(instance.render()).toBeTruthy();
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
