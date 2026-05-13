/* eslint-disable import/first */

declare const describe: any;
declare const it: any;
declare const expect: any;

import {isRemoteConfigKeyAllowed} from "../utils/remoteConfigWhitelist";

describe("node config whitelist", () => {
  it("rejects non-whitelisted config keys", () => {
    expect(isRemoteConfigKeyAllowed("content")).toBe(false);
    expect(isRemoteConfigKeyAllowed("document_name")).toBe(false);
  });

  it("accepts image hosting config keys", () => {
    expect(isRemoteConfigKeyAllowed("image_hosting_type")).toBe(true);
    expect(isRemoteConfigKeyAllowed("alioss_image_hosting")).toBe(true);
  });
});
