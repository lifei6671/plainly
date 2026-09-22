/* eslint-disable import/first */
import React from "react";

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

const message = {error: jest.fn(), success: jest.fn(), warning: jest.fn()};
const confirm = jest.fn();
const getDataStore = jest.fn();

jest.mock("antd", () => ({
  Button: ({children}: any) => React.createElement("button", null, children),
  Drawer: ({children}: any) => React.createElement("div", null, children),
  Empty: () => null,
  Modal: {confirm},
  Spin: () => null,
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

it("keeps empty directories visible in the tree", () => {
  const component = new DocumentNavigator(createProps() as any);
  attachState(component);
  (component as any).state.categories = [category];

  const tree = component.renderTree();

  expect(tree.props.treeData).toHaveLength(1);
  expect(tree.props.treeData[0].children).toEqual([]);
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
