declare const describe: (name: string, fn: () => void) => void;
declare const it: (name: string, fn: () => void) => void;
declare const expect: any;
declare const jest: any;

export {};

jest.mock("mobx-react", () => ({
  inject: () => (Comp) => Comp,
  observer: (Comp) => Comp,
}));

jest.mock("antd", () => ({
  Alert: () => null,
  Button: () => null,
  Checkbox: () => null,
  DatePicker: {RangePicker: () => null},
  Form: {Item: () => null},
  Input: Object.assign(() => null, {Password: () => null}),
  message: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
  Modal: () => null,
  Radio: Object.assign(() => null, {Button: () => null, Group: () => null}),
  Select: Object.assign(() => null, {Option: () => null}),
}));

jest.mock("../../data/store", () => ({
  getDataStore: jest.fn(),
}));

jest.mock("../../data/store/browser/BrowserDataStore", () => ({
  BrowserDataStore: jest.fn(),
}));

jest.mock("../../search", () => ({
  markIndexDirty: jest.fn(),
  scheduleIndexRebuild: jest.fn(),
}));

jest.mock("../../share/browserSnapshot", () => ({
  isShareSnapshotConflictError: jest.fn(() => false),
  syncShareSnapshotIfEnabled: jest.fn(),
}));

const {resolveShareListedState} = require("./RenameFileDialog");

describe("RenameFileDialog share settings", () => {
  it("defaults new public permanent shares to listed on the public index", () => {
    expect(resolveShareListedState(null, "public", "permanent")).toBe(true);
  });

  it("keeps existing share listed preference when settings already exist", () => {
    expect(resolveShareListedState({listed: false}, "public", "permanent")).toBe(false);
  });
});
