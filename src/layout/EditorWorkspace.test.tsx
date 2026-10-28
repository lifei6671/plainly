/* eslint-disable import/first */
import React from "react";
import {createRoot} from "react-dom/client";
import {flushSync} from "react-dom";
import {observable} from "mobx";

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock(
  "@uiw/react-codemirror",
  () =>
    class extends React.Component<any> {
      editor = {};

      render() {
        return <textarea value={this.props.value} readOnly />;
      }
    },
);
jest.mock("../component/SearchBox", () => () => null);
jest.mock("./Sidebar", () => () => null);
jest.mock("../utils/hotkey", () => ({
  __esModule: true,
  default: () => ({}),
  betterTab: jest.fn(),
  rightClick: jest.fn(),
}));
jest.mock("../utils/imageHosting", () => ({uploadAdaptor: jest.fn()}));
jest.mock("../utils/helper", () => ({
  countVisibleChars: (value) => value.length,
  markdownParser: {render: (value) => `<p>${value}</p>`, parse: () => []},
  markdownParserWechat: {render: (value) => `<p>${value}</p>`, parse: () => []},
  updateMathjax: jest.fn(),
}));
jest.mock("../utils/pluginCenter", () => ({mathjax: false, mermaid: false}));
jest.mock("../theme", () => ({resolveThemeHtmlForTemplate: (_templateNum, html) => html}));
jest.mock("mathjax/es5/tex-svg-full", () => ({}), {virtual: true});
jest.mock("mermaid", () => ({initialize: jest.fn(), run: jest.fn()}), {virtual: true});
jest.mock("antd", () => ({
  Button: ({children, icon, type, size, ...props}) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
  Tooltip: ({children}) => <>{children}</>,
  message: {error: jest.fn(), warning: jest.fn()},
}));

import MarkdownEditor from "./MarkdownEditor";
import MarkdownPreview from "./MarkdownPreview";
import StatusBar from "./StatusBar";
import {uploadAdaptor} from "../utils/imageHosting";

const createProps = () => ({
  content: {
    content: "initial",
    setContent: jest.fn(),
    setMarkdownEditor: jest.fn(),
  },
  dialog: {isSearchOpen: false},
  view: {isEditAreaOpen: true, isImmersiveEditing: false},
  onTextChange: jest.fn(),
  onScroll: jest.fn(),
  onBlur: jest.fn(),
});

beforeEach(() => jest.clearAllMocks());

it("only writes focused editor changes and flushes preview work on blur", () => {
  const props = createProps();
  const editor = new MarkdownEditor(props);
  const instance = {getValue: () => "edited"};
  editor.handleChange(instance);
  expect(props.content.setContent).not.toHaveBeenCalled();
  editor.handleFocus();
  editor.handleChange(instance);
  expect(props.content.setContent).toHaveBeenCalledWith("edited");
  expect(props.onTextChange).toHaveBeenCalledWith("edited");
  editor.handleBlur();
  editor.handleChange(instance);
  expect(props.content.setContent).toHaveBeenCalledTimes(1);
  expect(props.onBlur).toHaveBeenCalledTimes(1);
});

it("connects the CodeMirror instance and preserves dropped file order", () => {
  const props = createProps();
  const editor = new MarkdownEditor(props);
  const codeMirror = {};
  editor.getInstance({editor: codeMirror});
  expect(props.content.setMarkdownEditor).toHaveBeenCalledWith(codeMirror);
  const files = [new File(["a"], "a.png"), new File(["b"], "b.png")];
  editor.handleDrop(null, {dataTransfer: {files}});
  expect((uploadAdaptor as any).mock.calls.map(([options]) => options.file)).toEqual(files);
});

it("uploads pasted image files through the extracted editor handler", async () => {
  const props = createProps();
  const editor = new MarkdownEditor(props);
  const file = new File(["png"], "image.png", {type: "image/png"});
  await editor.handlePaste(null, {clipboardData: {files: [file], getData: () => ""}});
  expect(uploadAdaptor).toHaveBeenCalledWith({file, content: props.content});
});

it("keeps editor, preview and status reactive when their shared stores change", async () => {
  const content = observable({
    ...createProps().content,
    documentName: "before.md",
    documentCategoryName: "目录",
    documentUpdatedAt: 0,
  });
  const view = observable({isImmersiveEditing: false, isEditAreaOpen: true, isPreviewAreaOpen: true});
  const navbar = observable({codeNum: 0, templateNum: 0, previewType: "mobile"});
  const onNavigatorOpen = jest.fn();
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    flushSync(() =>
      root.render(
        <>
          <MarkdownEditor {...createProps()} content={content} view={view} />
          <MarkdownPreview content={content} view={view} navbar={navbar} />
          <StatusBar
            content={content}
            view={view}
            isRemoteMode={false}
            currentUser={null}
            onAuthOpen={jest.fn()}
            onNavigatorOpen={onNavigatorOpen}
            onCategoryManageOpen={jest.fn()}
            onDocumentSettingsOpen={jest.fn()}
          />
        </>,
      ),
    );
    flushSync(() => {
      content.content = "updated";
      content.documentName = "after.md";
      navbar.previewType = "pc";
    });
    expect(container.querySelector("textarea").value).toBe("updated");
    expect(container.querySelector("#nice-rich-text p").textContent).toBe("updated");
    expect(container.querySelector("#nice-rich-text").classList.contains("nice-marked-text-pc")).toBe(true);
    expect(container.querySelector(".nice-status-bar").textContent).toContain("after.md");
    expect(container.querySelector(".nice-status-bar").textContent).toContain("字符数:7");
    (container.querySelector('[aria-label="文档导航"]') as HTMLButtonElement).click();
    expect(onNavigatorOpen).toHaveBeenCalledTimes(1);
    flushSync(() => {
      view.isImmersiveEditing = true;
    });
    expect(container.querySelector("#nice-md-editor").classList.contains("nice-md-editing-immersive")).toBe(true);
    expect(container.querySelector("#nice-rich-text").classList.contains("nice-marked-text-hide")).toBe(true);
    expect(container.querySelector(".nice-status-bar").classList.contains("nice-status-bar-hide")).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
  } finally {
    flushSync(() => root.unmount());
    container.remove();
  }
});
