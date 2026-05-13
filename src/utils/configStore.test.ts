/* eslint-disable import/first */

jest.mock("../data/store", () => ({
  getDataStore: jest.fn(),
}));

declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

import {getConfig, setConfigSync} from "./configStore";
import {getDataStore} from "../data/store";

type MockStore = {
  getConfig: any;
  setConfig: any;
  removeConfig: any;
  listConfigKeys: any;
};

const createMockStore = (overrides: Partial<MockStore> = {}): MockStore => ({
  getConfig: jest.fn().mockResolvedValue(null),
  setConfig: jest.fn().mockResolvedValue(undefined),
  removeConfig: jest.fn().mockResolvedValue(undefined),
  listConfigKeys: jest.fn().mockResolvedValue([]),
  ...overrides,
});

beforeEach(() => {
  jest.resetModules();
  window.localStorage.clear();
  (getDataStore as any).mockReset();
});

it("uses the latest runtime store when saving config after login", () => {
  const localStore = createMockStore();
  const remoteStore = createMockStore();
  let currentStore = localStore;
  (getDataStore as any).mockImplementation(() => currentStore);

  currentStore = remoteStore;
  setConfigSync("alioss_image_hosting", {bucket: "demo"});

  expect(localStore.setConfig).not.toHaveBeenCalled();
  expect(remoteStore.setConfig).toHaveBeenCalledWith("alioss_image_hosting", {bucket: "demo"});
});

it("uses the latest runtime store when reading async config after login", async () => {
  const localStore = createMockStore({
    getConfig: jest.fn().mockResolvedValue({bucket: "local"}),
  });
  const remoteStore = createMockStore({
    getConfig: jest.fn().mockResolvedValue({bucket: "remote"}),
  });
  let currentStore = localStore;
  (getDataStore as any).mockImplementation(() => currentStore);

  currentStore = remoteStore;
  const result = await getConfig("alioss_image_hosting", null);

  expect(result).toEqual({bucket: "remote"});
  expect(localStore.getConfig).not.toHaveBeenCalled();
  expect(remoteStore.getConfig).toHaveBeenCalledWith("alioss_image_hosting", null);
});

it("does not sync non-whitelisted local config to remote store", () => {
  const remoteStore = createMockStore();
  (getDataStore as any).mockImplementation(() => remoteStore);

  setConfigSync("content", "# hello");

  expect(remoteStore.setConfig).not.toHaveBeenCalled();
  expect(window.localStorage.getItem("content")).toBe("# hello");
});
