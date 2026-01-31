import React, {useState, useEffect, useMemo} from "react";
import {Modal, Tabs, Form, Input, Button, Alert} from "antd";

/**
 * 轻量登录/注册/修改密码弹窗
 *
 * props:
 *  - visible: boolean
 *  - onClose: () => void
 *  - currentUser: {username: string} | null
 *  - onLogin: (username, password) => Promise<void>
 *  - onRegister: (username, password) => Promise<void>
 *  - onUpdatePassword: (oldPwd, newPwd) => Promise<void>
 *  - onLogout?: () => Promise<void> | void
 */

const usernameRules = [
  {required: true, message: "请输入用户名"},
  {pattern: /^[A-Za-z][A-Za-z0-9_]{5,17}$/, message: "以字母开头，6-18 位，仅字母/数字/下划线"},
];

const passwordRules = [{required: true, message: "请输入密码"}];

const resolveMode = () => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DATA_STORE) {
    return import.meta.env.VITE_DATA_STORE;
  }
  if (typeof window !== "undefined" && window.__DATA_STORE_MODE__) {
    return window.__DATA_STORE_MODE__;
  }
  if (typeof process !== "undefined" && process.env?.DATA_STORE_MODE) {
    return process.env.DATA_STORE_MODE;
  }
  return "browser";
};

const AuthModal = ({visible, onClose, currentUser, onLogin, onRegister, onUpdatePassword, onLogout}) => {
  const [activeKey, setActiveKey] = useState("login");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form] = Form.useForm();
  const [pwdForm] = Form.useForm();
  const [registerForm] = Form.useForm();
  const mode = useMemo(resolveMode, []);
  const isBrowserOnly = mode === "browser";

  useEffect(() => {
    if (visible) {
      setError("");
      setActiveKey(currentUser ? "account" : "login");
    } else {
      form.resetFields();
      pwdForm.resetFields();
      registerForm.resetFields();
      setLoading(false);
    }
  }, [visible, currentUser, form, pwdForm, registerForm]);

  const handleLogin = async (values) => {
    if (isBrowserOnly) {
      setError("当前为浏览器本地模式，未连接后端，无法登录。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onLogin(values.username.trim(), values.password);
      onClose();
    } catch (e) {
      setError(e?.message || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values) => {
    if (isBrowserOnly) {
      setError("当前为浏览器本地模式，未连接后端，无法注册。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onRegister(values.username.trim(), values.password);
      onClose();
    } catch (e) {
      setError(e?.message || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const handlePwd = async (values) => {
    if (isBrowserOnly) {
      setError("当前为浏览器本地模式，未连接后端，无法修改密码。");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await onUpdatePassword(values.oldPassword, values.newPassword);
      pwdForm.resetFields();
      onClose();
    } catch (e) {
      setError(e?.message || "修改密码失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      onCancel={onClose}
      footer={null}
      title={currentUser ? "账户" : "登录 / 注册"}
      width={420}
      bodyStyle={{paddingTop: 10}}
      destroyOnClose
    >
      {error && (
        <Alert style={{marginBottom: 12}} type="error" message={error} showIcon closable onClose={() => setError("")} />
      )}
      <Tabs activeKey={activeKey} onChange={setActiveKey} destroyInactiveTabPane type="card">
        {!currentUser && (
          <>
            <Tabs.TabPane tab="登录" key="login">
              {isBrowserOnly && (
                <Alert
                  style={{marginBottom: 12}}
                  type="warning"
                  message="当前为浏览器本地模式，登录/注册不可用。请切换远程模式连接后端。"
                  showIcon
                />
              )}
              <Form form={form} layout="vertical" onFinish={handleLogin}>
                <Form.Item name="username" label="用户名" rules={usernameRules}>
                  <Input placeholder="输入用户名" disabled={isBrowserOnly} autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={passwordRules}>
                  <Input.Password placeholder="输入密码" disabled={isBrowserOnly} autoComplete="current-password" />
                </Form.Item>
                <Button block type="primary" htmlType="submit" loading={loading} disabled={isBrowserOnly}>
                  登录
                </Button>
              </Form>
            </Tabs.TabPane>
            <Tabs.TabPane tab="注册" key="register">
              <Form form={registerForm} layout="vertical" onFinish={handleRegister}>
                <Form.Item name="username" label="用户名" rules={usernameRules}>
                  <Input placeholder="输入用户名" disabled={isBrowserOnly} autoComplete="username" />
                </Form.Item>
                <Form.Item name="password" label="密码" rules={passwordRules}>
                  <Input.Password placeholder="输入密码" disabled={isBrowserOnly} autoComplete="new-password" />
                </Form.Item>
                <Form.Item
                  name="confirm"
                  label="重复密码"
                  dependencies={["password"]}
                  rules={[
                    {required: true, message: "请再次输入密码"},
                    ({getFieldValue}) => ({
                      validator(_, value) {
                        if (!value || getFieldValue("password") === value) {
                          return Promise.resolve();
                        }
                        return Promise.reject(new Error("两次输入的密码不一致"));
                      },
                    }),
                  ]}
                >
                  <Input.Password placeholder="再次输入密码" disabled={isBrowserOnly} autoComplete="new-password" />
                </Form.Item>
                <Button block type="primary" htmlType="submit" loading={loading} disabled={isBrowserOnly}>
                  注册并登录
                </Button>
              </Form>
            </Tabs.TabPane>
          </>
        )}
        {currentUser ? (
          <Tabs.TabPane tab="账户" key="account">
            <div style={{marginBottom: 12}}>
              <div style={{display: "flex", alignItems: "center", gap: 8}}>
                <span>当前用户：{currentUser.username}</span>
                <Button size="small" type="default" onClick={onLogout} disabled={!onLogout}>
                  退出登录
                </Button>
              </div>
            </div>
            <Form form={pwdForm} layout="vertical" onFinish={handlePwd}>
              <Form.Item
                name="oldPassword"
                label="旧密码"
                rules={[{required: true, message: "请输入旧密码"}]}
              >
                <Input.Password />
              </Form.Item>
              <Form.Item
                name="newPassword"
                label="新密码"
                rules={[{required: true, message: "请输入新密码"}]}
              >
                <Input.Password />
              </Form.Item>
              <Button block type="primary" htmlType="submit" loading={loading}>
                修改密码
              </Button>
            </Form>
          </Tabs.TabPane>
        ) : null}
      </Tabs>
    </Modal>
  );
};

export default AuthModal;
