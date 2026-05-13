/* eslint-disable import/first */

declare const describe: any;
declare const it: any;
declare const expect: any;

import {filterRemoteConfigKeys, isRemoteConfigKeyAllowed, REMOTE_CONFIG_WHITELIST} from "./remoteConfigWhitelist";

describe("remote config whitelist", () => {
  it("only allows image hosting config keys", () => {
    expect(REMOTE_CONFIG_WHITELIST).toEqual([
      "SM_MS_TOKEN",
      "r2_image_hosting",
      "alioss_image_hosting",
      "qiniuoss_image_hosting",
      "image_hosting_type",
    ]);
    expect(isRemoteConfigKeyAllowed("content")).toBe(false);
    expect(isRemoteConfigKeyAllowed("document_name")).toBe(false);
    expect(isRemoteConfigKeyAllowed("alioss_image_hosting")).toBe(true);
  });

  it("filters out non-whitelisted keys", () => {
    expect(filterRemoteConfigKeys(["content", "image_hosting_type", "document_name", "SM_MS_TOKEN"])).toEqual([
      "image_hosting_type",
      "SM_MS_TOKEN",
    ]);
  });
});
