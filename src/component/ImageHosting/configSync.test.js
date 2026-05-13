const fs = require("fs");
const path = require("path");
const vm = require("vm");

const loadConfigSyncModule = () => {
  const source = fs.readFileSync(path.join(__dirname, "configSync.js"), "utf8");
  const transformed = `${source
    .replace(/export const /g, "const ")
    .replace(/export default\s*\{/, "const __defaultExport = {")}
module.exports = {
  loadHostingConfig,
  resolveHostingConfig,
  persistHostingConfig,
  default: __defaultExport,
};`;
  const module = {exports: {}};
  vm.runInNewContext(transformed, {module, exports: module.exports});
  return module.exports;
};

const {loadHostingConfig, resolveHostingConfig, persistHostingConfig} = loadConfigSyncModule();

describe("image hosting config sync", () => {
  it("hydrates local sync config after loading remote config", async () => {
    const hydrateConfigSync = jest.fn();
    const setConfigSync = jest.fn();
    const getConfig = jest.fn().mockResolvedValue({
      accountId: "acc-1",
      bucket: "bucket-1",
    });

    const result = await loadHostingConfig({
      key: "r2_image_hosting",
      defaults: {
        accountId: "",
        bucket: "",
        namespace: "",
      },
      getConfig,
      hydrateConfigSync,
      setConfigSync,
    });

    expect(result).toEqual({
      accountId: "acc-1",
      bucket: "bucket-1",
      namespace: "",
    });
    expect(hydrateConfigSync).toHaveBeenCalledWith("r2_image_hosting", result);
    expect(setConfigSync).not.toHaveBeenCalled();
  });

  it("persists config to sync store", () => {
    const setConfigSync = jest.fn();
    const config = {
      bucket: "bucket-1",
      accessKeyId: "key-1",
    };

    const result = persistHostingConfig({
      key: "r2_image_hosting",
      value: config,
      setConfigSync,
    });

    expect(result).toEqual(config);
    expect(setConfigSync).toHaveBeenCalledWith("r2_image_hosting", config);
  });

  it("falls back to remote config when local sync config is empty", async () => {
    const getConfigSync = jest.fn().mockReturnValue({});
    const getConfig = jest.fn().mockResolvedValue({
      bucket: "bucket-1",
      accessKeyId: "key-1",
    });
    const hydrateConfigSync = jest.fn();
    const setConfigSync = jest.fn();

    const result = await resolveHostingConfig({
      key: "r2_image_hosting",
      fallback: {},
      getConfigSync,
      getConfig,
      hydrateConfigSync,
      setConfigSync,
    });

    expect(result).toEqual({
      bucket: "bucket-1",
      accessKeyId: "key-1",
    });
    expect(hydrateConfigSync).toHaveBeenCalledWith("r2_image_hosting", result);
    expect(setConfigSync).not.toHaveBeenCalled();
  });
});
