import React from "react";

declare const jest: any;
declare const it: any;
declare const expect: any;

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
  const ReactLib = require("react");
  return {
    Button: ({children, ...props}) => ReactLib.createElement("button", props, children),
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
  })),
}));

jest.mock("./search", () => ({
  markIndexDirty: jest.fn(),
  scheduleIndexRebuild: jest.fn(),
}));

import App from "./App";

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

it("renders without crashing with injected props", () => {
  const instance = new App(props);
  expect(() => instance.render()).not.toThrow();
  expect(instance.render()).toBeTruthy();
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
