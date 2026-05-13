export {};

import {loadHostingConfig, resolveHostingConfig, persistHostingConfig} from "./configSync";

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const jest: any;

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
