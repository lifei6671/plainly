/* eslint-disable global-require, import/first */
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";

declare const jest: any;
declare const it: (name: string, fn: () => void) => void;
declare const expect: any;

jest.mock("antd", () => {
  const ReactLib = require("react");

  const FormComponent = ({children, onFinish}: any) =>
    ReactLib.createElement("form", {"data-has-submit": Boolean(onFinish)}, children);
  FormComponent.Item = ({children, label}: any) =>
    ReactLib.createElement("div", {"data-form-label": label || ""}, children);
  FormComponent.useForm = () => [{resetFields: jest.fn(), getFieldValue: jest.fn()}];

  const TabsComponent = ({children}: any) => ReactLib.createElement("div", {"data-tabs": "true"}, children);
  TabsComponent.TabPane = ({children, tab}: any) =>
    ReactLib.createElement("section", {"data-tab": tab || ""}, children);

  const InputComponent = (props: any) => ReactLib.createElement("input", props);
  InputComponent.Password = (props: any) => ReactLib.createElement("input", {...props, type: "password"});

  return {
    Modal: ({children}: any) => ReactLib.createElement("div", {"data-modal": "true"}, children),
    Tabs: TabsComponent,
    Form: FormComponent,
    Input: InputComponent,
    Button: ({children, htmlType, block, loading, ...props}: any) =>
      ReactLib.createElement("button", {...props, type: htmlType || "button"}, children),
    Alert: ({message}: any) => ReactLib.createElement("div", {"data-alert": "true"}, message),
  };
});

import AuthModal from "./AuthModal";

it("shows first-use guidance for unauthenticated remote login", () => {
  (globalThis as any).__IMPORT_META_ENV__ = {VITE_DATA_STORE: "remote"};

  const html = renderToStaticMarkup(
    <AuthModal
      visible
      onClose={() => undefined}
      currentUser={null}
      onLogin={async () => undefined}
      onRegister={async () => undefined}
      onUpdatePassword={async () => undefined}
      onLogout={() => undefined}
    />,
  );

  expect(html).toContain("首次使用请先注册账号");
});
