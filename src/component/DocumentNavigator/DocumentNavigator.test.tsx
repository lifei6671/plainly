/* eslint-disable import/first */
import React from "react";
import {LoadingOutlined} from "@ant-design/icons";

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

const message = {error: jest.fn(), success: jest.fn(), warning: jest.fn()};
const confirm = jest.fn();
const getDataStore = jest.fn();

jest.mock("antd", () => ({
  Button: ({children, icon, ...props}: any) => React.createElement("button", props, icon, children),
  Drawer: ({children, ...props}: any) => React.createElement("div", props, children),
  Empty: () => null,
  Modal: {confirm},
  Spin: () => null,
  Tooltip: ({children, ...props}: any) => React.createElement("tooltip", props, children),
  Tree: () => null,
  message,
}));

jest.mock("../../data/store", () => ({getDataStore}));
jest.mock("../../search", () => ({markIndexDirty: jest.fn(() => Promise.resolve()), scheduleIndexRebuild: jest.fn()}));

import {DocumentNavigator, getDocumentNavigatorStore} from ".";

const document = {document_id: "document-1", name: "示例文档", category_id: "category-1", createdAt: 1, updatedAt: 2};
const category = {id: 1, category_id: "category-1", name: "示例目录", createdAt: 1, updatedAt: 1};

const createStore = () => ({
  init: jest.fn(() => Promise.resolve()),
  listCategories: jest.fn(() => Promise.resolve([category])),
  listAllDocuments: jest.fn(() => Promise.resolve([document])),
  getDocumentContent: jest.fn(() => Promise.resolve("# 示例")),
  deleteDocument: jest.fn(() => Promise.resolve()),
});

const createProps = (overrides = {}) => ({
  open: true,
  pinned: false,
  userId: 0,
  isRemoteMode: false,
  content: {
    documentUuid: "",
    markdownEditor: {setValue: jest.fn(), focus: jest.fn()},
    setDocumentUuid: jest.fn(),
    setDocumentName: jest.fn(),
    setDocumentCategory: jest.fn(),
    setDocumentUpdatedAt: jest.fn(),
    setContent: jest.fn(),
  },
  onClose: jest.fn(),
  onPinnedChange: jest.fn(),
  ...overrides,
});

const attachState = (component: any) => {
  component.setState = jest.fn((updater: any, callback?: () => void) => {
    const nextState = typeof updater === "function" ? updater(component.state, component.props) : updater;
    component.state = {...component.state, ...nextState};
    if (callback) callback();
  });
};

const createDeferred = () => {
  let resolve: (value: string) => void;
  let reject: (reason: Error) => void;
  const promise = new Promise<string>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {promise, resolve, reject};
};

beforeEach(() => {
  jest.clearAllMocks();
});

it("uses getDataStore with the supplied user id", () => {
  getDocumentNavigatorStore(0);
  getDocumentNavigatorStore(42);

  expect(getDataStore).toHaveBeenNthCalledWith(1, 0);
  expect(getDataStore).toHaveBeenNthCalledWith(2, 42);
});

it("loads categories and documents when opened", async () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);

  await component.loadDocuments();

  expect(store.init).toHaveBeenCalled();
  expect(store.listCategories).toHaveBeenCalled();
  expect(store.listAllDocuments).toHaveBeenCalled();
  expect(component.state.expandedKeys).toEqual(["category:category-1"]);
});

it("loads a document into the editor and closes only when not pinned", async () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const props = createProps();
  const component = new DocumentNavigator(props as any);
  attachState(component);
  (component as any).state.categories = [category];

  await component.openDocument(document as any);

  expect(store.getDocumentContent).toHaveBeenCalledWith("document-1");
  expect(props.content.setDocumentUuid).toHaveBeenCalledWith("document-1");
  expect(props.content.setDocumentCategory).toHaveBeenCalledWith("category-1", "示例目录");
  expect(props.content.setContent).toHaveBeenCalledWith("# 示例");
  expect(props.onClose).toHaveBeenCalled();

  const pinnedProps = createProps({pinned: true});
  const pinnedComponent = new DocumentNavigator(pinnedProps as any);
  attachState(pinnedComponent);
  (pinnedComponent as any).state.categories = [category];
  await pinnedComponent.openDocument(document as any);
  expect(pinnedProps.onClose).not.toHaveBeenCalled();
});

it("shows loading feedback immediately while opening a document", async () => {
  const deferred = createDeferred();
  const store = createStore();
  store.getDocumentContent.mockReturnValue(deferred.promise);
  getDataStore.mockReturnValue(store);
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);

  const opening = component.openDocument(document as any);
  const title = component.renderDocumentTitle(document as any);
  const openButton = title.props.children[0];

  expect(component.state.openingDocumentId).toBe("document-1");
  expect(title.props.className).toContain("opening");
  expect(openButton.props["aria-busy"]).toBe(true);
  expect(openButton.props.children[0].type).toBe(LoadingOutlined);

  await component.openDocument(document as any);
  expect(store.getDocumentContent).toHaveBeenCalledTimes(1);

  deferred.resolve("# 示例");
  await opening;
});

it("clears loading feedback after a document opens or fails", async () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const props = createProps();
  const component = new DocumentNavigator(props as any);
  attachState(component);
  (component as any).state.categories = [category];

  await component.openDocument(document as any);

  expect(component.state.openingDocumentId).toBeNull();
  expect(props.content.setContent).toHaveBeenCalledWith("# 示例");
  expect(props.content.markdownEditor.setValue).toHaveBeenCalledWith("# 示例");

  store.getDocumentContent.mockRejectedValueOnce(new Error("network failed"));
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  await component.openDocument(document as any);
  consoleError.mockRestore();

  expect(component.state.openingDocumentId).toBeNull();
  expect(message.error).toHaveBeenCalledWith("加载文档失败");
});

it("keeps the latest document when earlier opening requests resolve later", async () => {
  const first = createDeferred();
  const second = createDeferred();
  const secondDocument = {...document, document_id: "document-2", name: "第二篇文档"};
  const store = createStore();
  store.getDocumentContent.mockImplementation((documentId: string) =>
    documentId === "document-1" ? first.promise : second.promise,
  );
  getDataStore.mockReturnValue(store);
  const props = createProps();
  const component = new DocumentNavigator(props as any);
  attachState(component);
  (component as any).state.categories = [category];

  const openingFirst = component.openDocument(document as any);
  const openingSecond = component.openDocument(secondDocument as any);

  first.resolve("# 第一篇");
  await openingFirst;

  expect(component.state.openingDocumentId).toBe("document-2");
  expect(props.content.setContent).not.toHaveBeenCalled();

  second.resolve("# 第二篇");
  await openingSecond;

  expect(component.state.openingDocumentId).toBeNull();
  expect(props.content.setDocumentUuid).toHaveBeenCalledWith("document-2");
  expect(props.content.setContent).toHaveBeenCalledWith("# 第二篇");
});

it("keeps empty directories visible in the tree", () => {
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);
  (component as any).state.categories = [category];

  const tree = component.renderTree();

  expect(tree.props.treeData).toHaveLength(1);
  expect(tree.props.treeData[0].children).toEqual([]);
});

it("toggles categories from their titles while preserving the Tree expand handler", () => {
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);
  (component as any).state.categories = [category];
  (component as any).state.expandedKeys = ["category:category-1"];

  const tree = component.renderTree();
  const categoryTitle = tree.props.treeData[0].title;
  categoryTitle.props.onClick();
  expect(component.state.expandedKeys).toEqual([]);

  categoryTitle.props.onClick();
  expect(component.state.expandedKeys).toEqual(["category:category-1"]);
  expect(tree.props.onExpand).toBe(component.handleExpand);
});

it("renders the document section and visual hooks for active document rows", () => {
  const component = new DocumentNavigator(createProps({content: {...createProps().content, documentUuid: "document-1"}}) as any);
  attachState(component);
  (component as any).state.categories = [category];

  const navigator = component.renderNavigator();
  const treeWrap = navigator.props.children[1];
  const tree = component.renderTree();
  const documentTitle = component.renderDocumentTitle(document as any);

  expect(treeWrap.props.children[0].props.className).toBe("nice-document-navigator-section-label");
  expect(treeWrap.props.children[0].props.children).toBe("目录");
  expect(tree.props.blockNode).toBe(true);
  expect(tree.props.treeData[0].title.props.className).toContain("nice-document-navigator-category-node");
  expect(documentTitle.props.className).toContain("active");
  expect(tree.props.motion.motionName).toBe("nice-document-navigator-tree-motion");
});

it("shows a right-placed tooltip containing the complete document title", () => {
  const component = new DocumentNavigator(createProps() as any);
  const documentTitle = component.renderDocumentTitle(document as any);
  const openButton = documentTitle.props.children[0];
  const tooltip = openButton.props.children[1];

  expect(tooltip.props.placement).toBe("right");
  expect(tooltip.props.title).toBe("示例文档");
});

it("adds a scoped class to the navigator drawer", () => {
  const component = new DocumentNavigator(createProps() as any);

  expect(component.render().props.className).toBe("nice-document-navigator-drawer");
});

it("opens the same document on every title-button click", async () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const props = createProps();
  const component = new DocumentNavigator(props as any);
  attachState(component);
  (component as any).state.categories = [category];
  const title = component.renderDocumentTitle(document as any);
  const openButton = title.props.children[0];

  await openButton.props.onClick();
  await openButton.props.onClick();

  expect(store.getDocumentContent).toHaveBeenCalledTimes(2);
  expect(props.onClose).toHaveBeenCalledTimes(2);
});

it("does not open a document when its delete button is clicked", () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);
  const title = component.renderDocumentTitle(document as any);
  const deleteButton = title.props.children[1];
  const event = {stopPropagation: jest.fn()};

  deleteButton.props.onClick(event);

  expect(event.stopPropagation).toHaveBeenCalled();
  expect(store.getDocumentContent).not.toHaveBeenCalled();
  expect(confirm).toHaveBeenCalled();
});

it("does not delete the current document", () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  const component = new DocumentNavigator(createProps({content: {...createProps().content, documentUuid: "document-1"}}) as any);
  attachState(component);

  component.deleteDocument(document as any);

  expect(message.warning).toHaveBeenCalledWith("当前正在编辑该文档，不能删除。");
  expect(confirm).not.toHaveBeenCalled();
  expect(store.deleteDocument).not.toHaveBeenCalled();
});

it("deletes a non-current document after confirmation", async () => {
  const store = createStore();
  getDataStore.mockReturnValue(store);
  confirm.mockImplementation(({onOk}: any) => onOk());
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);
  (component as any).state.documents = [document];

  component.deleteDocument(document as any);
  await Promise.resolve();

  expect(store.deleteDocument).toHaveBeenCalledWith("document-1");
  expect(component.state.documents).toEqual([]);
  expect(message.success).toHaveBeenCalledWith("删除成功");
});
