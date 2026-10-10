/* eslint-disable import/first */
import React from "react";

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock("mobx-react", () => ({inject: () => (component) => component, observer: (component) => component}));
jest.mock("antd", () => ({
  Modal: () => null,
  Table: () => null,
  Button: () => null,
  Input: () => null,
  Drawer: () => null,
  Empty: () => null,
  Spin: () => null,
  Tooltip: () => null,
  Tree: () => null,
  message: {error: jest.fn(), success: jest.fn(), warning: jest.fn()},
}));
jest.mock("../../data/store", () => ({
  getDataStore: jest.fn(),
  resolveDataStoreInfo: (userId) => ({userId, effectiveMode: userId > 0 ? "remote" : "browser"}),
}));
jest.mock("../../data/store/browser/BrowserDataStore", () => ({BrowserDataStore: jest.fn()}));
jest.mock("../../search", () => ({markIndexDirty: jest.fn(), scheduleIndexRebuild: jest.fn()}));

import CategoryManageDialog from "./CategoryManageDialog";
import {message} from "antd";
import {DocumentNavigator} from "../DocumentNavigator";
import {getDataStore} from "../../data/store";
import {DEFAULT_CATEGORY_UUID} from "../../utils/constant";

const categories = [
  {id: 1, category_id: DEFAULT_CATEGORY_UUID, name: "默认目录", count: 0, createdAt: 1, updatedAt: 1},
  {id: 2, category_id: "a", name: "目录 A", count: 2, createdAt: 1, updatedAt: 1},
  {id: 3, category_id: "b", name: "目录 B", count: 1, createdAt: 1, updatedAt: 1},
];
const attachState = (component: any) => {
  component.setState = (update: any, callback?: () => void) => {
    component.state = {...component.state, ...(typeof update === "function" ? update(component.state) : update)};
    if (callback) callback();
  };
};
const createDialog = () => {
  const component = new CategoryManageDialog({dialog: {isCategoryManageOpen: true}, content: {}});
  attachState(component);
  return component;
};
const getTable = (component) => component.render().props.children[0].props.children[1];
const dragTo = (component, source, target) => {
  const table = getTable(component);
  const title = table.props.columns[0].render(source.name, source);
  expect(React.isValidElement(title)).toBe(true);
  const handle = title.props.children[0];
  expect(handle.props.draggable).toBe(true);
  handle.props.onDragStart({dataTransfer: {setData: jest.fn(), effectAllowed: ""}});
  const targetRow = getTable(component).props.onRow(target);
  targetRow.onDragOver({preventDefault: jest.fn(), dataTransfer: {dropEffect: ""}});
  targetRow.onDrop({preventDefault: jest.fn()});
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  window.__DATA_STORE_USER_ID__ = 0;
  window.__DATA_STORE_MODE__ = "browser";
  (getDataStore as any).mockReturnValue({
    init: jest.fn(() => Promise.resolve()),
    listCategoriesWithCount: jest.fn(() => Promise.resolve(categories)),
    listCategories: jest.fn(() => Promise.resolve(categories)),
    listAllDocuments: jest.fn(() => Promise.resolve([])),
  });
});

it("moves directories from the name handle in either direction and persists the order", async () => {
  const component = createDialog();
  await component.loadCategories();
  dragTo(component, categories[0], categories[2]);
  expect(component.state.categories.map((item) => item.category_id)).toEqual(["a", "b", DEFAULT_CATEGORY_UUID]);
  expect(JSON.parse(window.localStorage.getItem("categoryOrder:browser:0"))).toEqual(["a", "b", DEFAULT_CATEGORY_UUID]);

  dragTo(component, categories[2], categories[1]);
  expect(component.state.categories.map((item) => item.category_id)).toEqual(["b", "a", DEFAULT_CATEGORY_UUID]);
  const reopened = createDialog();
  await reopened.loadCategories();
  expect(reopened.state.categories.map((item) => item.category_id)).toEqual(["b", "a", DEFAULT_CATEGORY_UUID]);
});

it("uses the saved order in the document navigator without changing collapsed directories", async () => {
  const component = createDialog();
  await component.loadCategories();
  window.localStorage.setItem("documentNavigatorCollapsedKeys:local:0", '["category:a"]');
  const navigator = new DocumentNavigator({open: false, pinned: true, userId: 0, isRemoteMode: false} as any);
  attachState(navigator);
  navigator.componentDidMount();
  try {
    await navigator.loadDocuments();
    dragTo(component, categories[2], categories[0]);
    expect(navigator.renderTree().props.treeData.map((item) => item.key)).toEqual([
      "category:b", `category:${DEFAULT_CATEGORY_UUID}`, "category:a",
    ]);
    expect(navigator.state.expandedKeys).not.toContain("category:a");
    const reopened = new DocumentNavigator({open: true, pinned: false, userId: 0, isRemoteMode: false} as any);
    attachState(reopened);
    await reopened.loadDocuments();
    expect(reopened.state.categories.map((item) => item.category_id)).toEqual(["b", DEFAULT_CATEGORY_UUID, "a"]);
  } finally {
    if (navigator.componentWillUnmount) navigator.componentWillUnmount();
  }
});

it("leaves the order unchanged for an external drop or a drop on the same directory", async () => {
  const component = createDialog();
  await component.loadCategories();
  getTable(component).props.onRow(categories[1]).onDrop({preventDefault: jest.fn()});
  dragTo(component, categories[1], categories[1]);
  expect(component.state.categories).toEqual(categories);
  expect(window.localStorage.getItem("categoryOrder:browser:0")).toBeNull();
});

it("reports persistence failure and keeps the previous displayed order", async () => {
  const component = createDialog();
  await component.loadCategories();
  const setItem = jest.spyOn(Object.getPrototypeOf(window.localStorage), "setItem").mockImplementation(() => {
    throw new Error("storage unavailable");
  });
  const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
  try {
    dragTo(component, categories[0], categories[2]);
    expect(component.state.categories).toEqual(categories);
    expect(message.error).toHaveBeenCalledWith("保存目录排序失败");
  } finally {
    setItem.mockRestore();
    consoleError.mockRestore();
  }
});
