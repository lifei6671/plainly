/* eslint-disable import/first */
import React from "react";

declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;

jest.mock("mobx-react", () => ({
  inject: () => (Comp) => Comp,
  observer: (Comp) => Comp,
}));

jest.mock("antd", () => ({
  Modal: ({children}) => React.createElement("div", null, children),
  Upload: {Dragger: ({children}) => React.createElement("div", null, children)},
  Tabs: ({children}) => React.createElement("div", null, children),
  Select: ({children}) => React.createElement("div", null, children),
  message: {success: jest.fn(), error: jest.fn()},
}));

jest.mock("../../icon", () => () => null);
jest.mock("../ImageHosting/AliOSS", () => () => null);
jest.mock("../ImageHosting/QiniuOSS", () => () => null);
jest.mock("../ImageHosting/Smms", () => () => null);
jest.mock("../ImageHosting/R2", () => () => null);
jest.mock("../../utils/imageHosting", () => ({uploadAdaptor: jest.fn()}));
jest.mock("../../utils/configStore", () => ({setConfigSync: jest.fn()}));

import ImageDialog from "./ImageDialog";

const createProps = () => {
  const markdownEditor = {
    getCursor: jest.fn(() => ({line: 1, ch: 0})),
    replaceSelection: jest.fn(),
    getValue: jest.fn(() => "# current content"),
  };

  return {
    navbar: {
      isContainImgName: true,
    },
    dialog: {
      isImageOpen: true,
      setImageOpen: jest.fn(),
    },
    content: {
      markdownEditor,
      setContent: jest.fn(),
    },
    imageHosting: {
      hostingList: [],
      type: "SM.MS",
      setType: jest.fn(),
    },
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ImageDialog", () => {
  it("does not save document content when only confirming config changes", () => {
    const props = createProps();
    const instance = new ImageDialog(props);

    instance.images = [];
    instance.handleOk();

    expect(props.content.markdownEditor.replaceSelection).not.toHaveBeenCalled();
    expect(props.content.setContent).not.toHaveBeenCalled();
    expect(props.dialog.setImageOpen).toHaveBeenCalledWith(false);
  });

  it("still inserts markdown and saves content after image upload", () => {
    const props = createProps();
    const instance = new ImageDialog(props);

    instance.images = [{filename: "demo.png", url: "https://cdn.example/demo.png"}];
    instance.handleOk();

    expect(props.content.markdownEditor.replaceSelection).toHaveBeenCalledWith(
      "![demo.png](https://cdn.example/demo.png)\n",
      {line: 1, ch: 0},
    );
    expect(props.content.setContent).toHaveBeenCalledWith("# current content");
    expect(props.dialog.setImageOpen).toHaveBeenCalledWith(false);
  });
});
