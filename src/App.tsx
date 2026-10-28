import React, {Component} from "react";
import "antd/dist/antd.css";
import {observer, inject} from "mobx-react";
import classnames from "classnames";

import Dialog from "./layout/Dialog";
import MarkdownEditor from "./layout/MarkdownEditor";
import MarkdownPreview from "./layout/MarkdownPreview";
import StatusBar from "./layout/StatusBar";
import {syncLocalToRemote} from "./utils/syncLocalToRemote";
import Navbar from "./layout/Navbar";
import StyleEditor from "./layout/StyleEditor";
import EditorMenu from "./layout/EditorMenu";

import "./App.css";
import "./utils/mdMirror.css";

import {IMAGE_HOSTING_NAMES, IMAGE_HOSTING_TYPE} from "./utils/constant";
import appContext, {ImageHostingPreset} from "./utils/appContext";
import AuthModal from "./component/Auth/AuthModal";
import DocumentNavigator from "./component/DocumentNavigator";
import {getConfigSync, setConfigSync} from "./utils/configStore";
import {BrowserDataStore} from "./data/store/browser/BrowserDataStore";
import {markIndexDirty, scheduleIndexRebuild} from "./search";
import {
  buildLiveHeadingAnchors,
  mapEditorToPreviewByAnchors,
  mapPreviewToEditorByAnchors,
  mapScrollByRatio,
} from "./utils/syncScroll";

const SESSION_FLAG_COOKIE = "plainly_session";
const DATA_STORE_USER_ID_KEY = "__DATA_STORE_USER_ID__";
const CURRENT_USER_ID_KEY = "__CURRENT_USER_ID__";
const DATA_STORE_MODE_KEY = "__DATA_STORE_MODE__";

type RuntimeUser = {
  id: number;
  account?: string;
  username?: string;
} | null;

type AppProps = {
  content?: any;
  navbar?: any;
  view?: any;
  dialog?: any;
  imageHosting?: any;
  defaultText?: string;
  onTextChange?: (content: string) => void;
  useImageHosting?: ImageHostingPreset;
};

type AppState = {
  authVisible: boolean;
  currentUser: RuntimeUser;
  documentNavigatorOpen: boolean;
  documentNavigatorPinned: boolean;
};

@inject("content")
@inject("navbar")
@inject("view")
@inject("dialog")
@inject("imageHosting")
@observer
class App extends Component<AppProps, AppState> {
  syncScrollLock: "editor" | "preview" | null = null;

  syncScrollReleaseFrame: number | null = null;

  previewContainer: HTMLDivElement | null = null;

  previewWrap: HTMLElement | null = null;

  previewRef = React.createRef<MarkdownPreview>();

  isRemoteMode: boolean;

  apiBase: string;

  constructor(props: AppProps) {
    super(props);
    this.state = {
      authVisible: false,
      currentUser: null,
      documentNavigatorOpen: false,
      documentNavigatorPinned: false,
    };
    this.isRemoteMode = this.resolveDataStoreMode() === "remote";
    this.apiBase =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
      (typeof process !== "undefined" && process.env?.VITE_API_BASE) ||
      "/api";
  }

  componentDidMount() {
    document.addEventListener("fullscreenchange", this.solveScreenChange);
    document.addEventListener("webkitfullscreenchange", this.solveScreenChange);
    document.addEventListener("mozfullscreenchange", this.solveScreenChange);
    document.addEventListener("MSFullscreenChange", this.solveScreenChange);
    this.setEditorContent();
    this.setCustomImageHosting();
    this.loadCurrentUser();
  }

  componentWillUnmount() {
    document.removeEventListener("fullscreenchange", this.solveScreenChange);
    document.removeEventListener("webkitfullscreenchange", this.solveScreenChange);
    document.removeEventListener("mozfullscreenchange", this.solveScreenChange);
    document.removeEventListener("MSFullscreenChange", this.solveScreenChange);
    if (this.syncScrollReleaseFrame !== null) this.cancelFrame(this.syncScrollReleaseFrame);
  }

  setRuntimeUser = (user) => {
    if (typeof window !== "undefined") {
      const windowAny = window as any;
      if (user && user.id) {
        windowAny[DATA_STORE_USER_ID_KEY] = user.id;
        windowAny[CURRENT_USER_ID_KEY] = user.id;
      } else {
        windowAny[DATA_STORE_USER_ID_KEY] = 0;
        windowAny[CURRENT_USER_ID_KEY] = 0;
      }
    }
  };

  getRuntimeUserId = () => {
    if (typeof window === "undefined") return 0;
    const windowAny = window as any;
    return windowAny[DATA_STORE_USER_ID_KEY] || windowAny[CURRENT_USER_ID_KEY] || 0;
  };

  hasSessionCookie = () => {
    if (typeof document === "undefined") return false;
    return document.cookie.split(";").some((item) => item.trim().startsWith(`${SESSION_FLAG_COOKIE}=`));
  };

  syncLocalToRemote = async (user) => {
    if (!this.isRemoteMode || !user || !user.id) return;
    await syncLocalToRemote(user, this.props.content);
  };

  clearRemoteHistory = async (userId) => {
    if (!userId || typeof indexedDB === "undefined") return;
    await new Promise<void>((resolve) => {
      const request = indexedDB.open("mdnice-local-history");
      request.onerror = () => resolve();
      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db || !db.objectStoreNames.contains("customers")) {
          resolve();
          return;
        }
        const tx = db.transaction(["customers"], "readwrite");
        const store = tx.objectStore("customers");
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (cursorEvent) => {
          const cursor = (cursorEvent.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (!cursor) return;
          const value = cursor.value || {};
          const uid = Number(value.Uid || 0);
          if (uid === userId && value.Source === "remote") {
            cursor.delete();
          }
          cursor.continue();
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
    });
  };

  clearRemoteCache = async (userId) => {
    if (!userId) return;
    const cacheStore = new BrowserDataStore(Number(userId) || 0);
    await cacheStore.init();
    await cacheStore.clearRemoteData();
    await this.clearRemoteHistory(Number(userId) || 0);
    try {
      await markIndexDirty();
      scheduleIndexRebuild();
    } catch (e) {
      console.error(e);
    }
  };

  resolveDataStoreMode = () => {
    if (typeof import.meta !== "undefined" && import.meta.env?.VITE_DATA_STORE) {
      return import.meta.env.VITE_DATA_STORE;
    }
    if (typeof window !== "undefined" && (window as any)[DATA_STORE_MODE_KEY]) {
      return (window as any)[DATA_STORE_MODE_KEY];
    }
    if (typeof process !== "undefined" && process.env?.DATA_STORE_MODE) {
      return process.env.DATA_STORE_MODE;
    }
    return "browser";
  };

  setCustomImageHosting = () => {
    if (this.props.useImageHosting === undefined) {
      return;
    }
    const {url, name, isSmmsOpen, isQiniuyunOpen, isAliyunOpen} = this.props.useImageHosting;
    if (name) {
      this.props.imageHosting.setHostingUrl(url);
      this.props.imageHosting.setHostingName(name);
      this.props.imageHosting.addImageHosting(name);
    }
    if (isSmmsOpen) {
      this.props.imageHosting.addImageHosting(IMAGE_HOSTING_NAMES.smms);
    }
    if (this.props.useImageHosting.isR2Open) {
      this.props.imageHosting.addImageHosting(IMAGE_HOSTING_NAMES.r2);
    }
    if (isAliyunOpen) {
      this.props.imageHosting.addImageHosting(IMAGE_HOSTING_NAMES.aliyun);
    }
    if (isQiniuyunOpen) {
      this.props.imageHosting.addImageHosting(IMAGE_HOSTING_NAMES.qiniuyun);
    }

    // 第一次进入没有默认图床时
    const storedType = getConfigSync(IMAGE_HOSTING_TYPE, null);
    if (storedType === null) {
      let type = "";
      if (name) {
        type = name;
      } else if (isSmmsOpen) {
        type = IMAGE_HOSTING_NAMES.smms;
      } else if (isAliyunOpen) {
        type = IMAGE_HOSTING_NAMES.aliyun;
      } else if (isQiniuyunOpen) {
        type = IMAGE_HOSTING_NAMES.qiniuyun;
      }
      if (type) {
        this.props.imageHosting.setType(type);
        setConfigSync(IMAGE_HOSTING_TYPE, type);
      }
    } else {
      this.props.imageHosting.setType(storedType);
    }
  };

  loadCurrentUser = async () => {
    if (!this.isRemoteMode) {
      this.setRuntimeUser(null);
      this.setState({currentUser: null});
      return;
    }
    if (!this.hasSessionCookie()) {
      this.setRuntimeUser(null);
      this.setState({currentUser: null});
      return;
    }
    let mapped: RuntimeUser = null;
    try {
      const user = await this.apiRequest("/auth/refresh", "POST");
      mapped = this.mapUser(user?.user);
      this.setRuntimeUser(mapped);
      this.setState({currentUser: mapped});
    } catch (_e) {
      this.setRuntimeUser(null);
      this.setState({currentUser: null});
      return;
    }
    try {
      await this.syncLocalToRemote(mapped);
    } catch (e) {
      console.error(e);
    }
  };

  handleAuthOpen = () => {
    this.setState({authVisible: true});
  };

  handleCategoryManageOpen = () => {
    this.props.dialog.setCategoryManageOpen(true);
  };

  handleDocumentSettingsOpen = () => {
    this.props.dialog.setRenameFileOpen(true);
  };

  handleDocumentNavigatorOpen = () => {
    this.setState({documentNavigatorOpen: true});
  };

  handleDocumentNavigatorClose = () => {
    this.setState({documentNavigatorOpen: false, documentNavigatorPinned: false});
  };

  handleDocumentNavigatorPinnedChange = (documentNavigatorPinned: boolean) => {
    this.setState({documentNavigatorPinned, documentNavigatorOpen: true});
  };

  handleAuthClose = () => {
    this.setState({authVisible: false});
  };

  apiRequest = async (path: string, method?: string, body?: unknown) => {
    const requestMethod = method || "GET";
    const res = await fetch(`${this.apiBase}${path}`, {
      method: requestMethod,
      headers: {"Content-Type": "application/json"},
      credentials: "include",
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (json && json.errmsg) || res.statusText || "请求失败";
      throw new Error(msg);
    }
    if (json && json.errcode !== undefined && json.errcode !== 0) {
      throw new Error(json.errmsg || "请求失败");
    }
    return json ? json.data : null;
  };

  handleLogin = async (username, password) => {
    if (!this.isRemoteMode) throw new Error("当前为浏览器本地模式，无法登录");
    const resp = await this.apiRequest("/auth/login", "POST", {account: username, password});
    const mapped = this.mapUser(resp?.user);
    this.setRuntimeUser(mapped);
    this.setState({currentUser: mapped});
    await this.syncLocalToRemote(mapped);
  };

  handleRegister = async (username, password) => {
    if (!this.isRemoteMode) throw new Error("当前为浏览器本地模式，无法注册");
    const resp = await this.apiRequest("/auth/register", "POST", {account: username, password});
    const mapped = this.mapUser(resp?.user);
    this.setRuntimeUser(mapped);
    this.setState({currentUser: mapped});
    await this.syncLocalToRemote(mapped);
  };

  handleUpdatePassword = async (oldPwd, newPwd) => {
    if (!this.isRemoteMode) throw new Error("当前为浏览器本地模式，无法修改密码");
    await this.apiRequest("/auth/password", "POST", {oldPassword: oldPwd, newPassword: newPwd});
    const userId = this.state.currentUser?.id || this.getRuntimeUserId();
    await this.clearRemoteCache(userId);
    this.setRuntimeUser(null);
    this.setState({currentUser: null});
  };

  handleLogout = async () => {
    const userId = this.state.currentUser?.id || this.getRuntimeUserId();
    if (this.isRemoteMode) {
      try {
        await this.apiRequest("/auth/logout", "POST");
      } catch (e) {
        console.error(e);
      }
    }
    await this.clearRemoteCache(userId);
    this.setRuntimeUser(null);
    this.setState({currentUser: null});
  };

  setEditorContent = () => {
    const {defaultText} = this.props;
    if (defaultText) {
      this.props.content.setContent(defaultText);
    }
  };

  mapUser = (u: any): RuntimeUser => {
    if (!u) return null;
    return {
      id: u.id,
      account: u.account || u.username,
      username: u.username || u.account,
    };
  };

  solveScreenChange = () => {
    const {isImmersiveEditing} = this.props.view;
    this.props.view.setImmersiveEditing(!isImmersiveEditing);
  };

  requestFrame = (callback: FrameRequestCallback): number => {
    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
      return window.requestAnimationFrame(callback);
    }
    return (setTimeout(() => callback(Date.now()), 0) as unknown) as number;
  };

  cancelFrame = (frame: number) => {
    if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
      window.cancelAnimationFrame(frame);
    } else {
      clearTimeout((frame as unknown) as ReturnType<typeof setTimeout>);
    }
  };

  releaseScrollSyncLock = (source: "editor" | "preview") => {
    if (this.syncScrollReleaseFrame !== null) this.cancelFrame(this.syncScrollReleaseFrame);
    this.syncScrollReleaseFrame = this.requestFrame(() => {
      this.syncScrollReleaseFrame = null;
      if (this.syncScrollLock === source) this.syncScrollLock = null;
    });
  };

  handleEditorScroll = () => {
    if (!this.props.navbar.isSyncScroll || this.syncScrollLock === "preview") return;
    const {markdownEditor} = this.props.content;
    if (!markdownEditor || !this.previewContainer) return;
    const scrollInfo = markdownEditor.getScrollInfo();
    const anchors = this.previewWrap
      ? buildLiveHeadingAnchors({
          markdownEditor,
          previewContainer: this.previewContainer,
          previewRoot: this.previewWrap,
        })
      : null;
    const targetPreviewTop =
      mapEditorToPreviewByAnchors(anchors, scrollInfo.top) ??
      mapScrollByRatio(
        scrollInfo.top,
        scrollInfo.height,
        scrollInfo.clientHeight,
        this.previewContainer.scrollHeight,
        this.previewContainer.clientHeight,
      );
    this.syncScrollLock = "editor";
    this.previewContainer.scrollTop = targetPreviewTop;
    this.releaseScrollSyncLock("editor");
  };

  handlePreviewScroll = () => {
    if (!this.props.navbar.isSyncScroll || this.syncScrollLock === "editor") return;
    const {markdownEditor} = this.props.content;
    if (!markdownEditor || !this.previewContainer) return;
    const scrollInfo = markdownEditor.getScrollInfo();
    const anchors = this.previewWrap
      ? buildLiveHeadingAnchors({
          markdownEditor,
          previewContainer: this.previewContainer,
          previewRoot: this.previewWrap,
        })
      : null;
    const targetEditorTop =
      mapPreviewToEditorByAnchors(anchors, this.previewContainer.scrollTop) ??
      mapScrollByRatio(
        this.previewContainer.scrollTop,
        this.previewContainer.scrollHeight,
        this.previewContainer.clientHeight,
        scrollInfo.height,
        scrollInfo.clientHeight,
      );
    this.syncScrollLock = "preview";
    markdownEditor.scrollTo(null, targetEditorTop);
    this.releaseScrollSyncLock("preview");
  };

  handleBlur = () => this.previewRef.current?.flushMermaid();

  setPreviewContainer = (node: HTMLDivElement | null) => {
    this.previewContainer = node;
  };

  setPreviewRoot = (node: HTMLElement | null) => {
    this.previewWrap = node;
  };

  render() {
    const {content, navbar, view, dialog, onTextChange} = this.props;
    const {isStyleEditorOpen, isImmersiveEditing} = view;
    const {documentNavigatorOpen, documentNavigatorPinned, currentUser} = this.state;
    const styleEditingClass = classnames({"nice-style-editing": true, "nice-style-editing-hide": isImmersiveEditing});
    const textContainerClass = classnames({
      "nice-text-container": !isImmersiveEditing,
      "nice-text-container-immersive": isImmersiveEditing,
    });
    const appClass = classnames({
      App: true,
      "nice-document-navigator-pinned": documentNavigatorOpen && documentNavigatorPinned,
    });
    const documentNavigatorUserId = this.isRemoteMode && currentUser ? currentUser.id : 0;
    return (
      <appContext.Consumer>
        {(ctx) => (
          <div className={appClass}>
            <Navbar title={ctx?.defaultTitle || ""} />
            <div className={textContainerClass}>
              <MarkdownEditor
                content={content}
                dialog={dialog}
                view={view}
                onTextChange={onTextChange}
                onScroll={this.handleEditorScroll}
                onBlur={this.handleBlur}
              />
              <MarkdownPreview
                ref={this.previewRef}
                content={content}
                navbar={navbar}
                view={view}
                onScroll={this.handlePreviewScroll}
                onContainerRef={this.setPreviewContainer}
                onRootRef={this.setPreviewRoot}
              />
              {isStyleEditorOpen && (
                <div id="nice-style-editor" className={styleEditingClass}>
                  <StyleEditor />
                </div>
              )}
              <Dialog />
              <EditorMenu />
            </div>
            <StatusBar
              content={content}
              view={view}
              isRemoteMode={this.isRemoteMode}
              currentUser={currentUser}
              onAuthOpen={this.handleAuthOpen}
              onNavigatorOpen={this.handleDocumentNavigatorOpen}
              onCategoryManageOpen={this.handleCategoryManageOpen}
              onDocumentSettingsOpen={this.handleDocumentSettingsOpen}
            />
            <AuthModal
              visible={this.state.authVisible}
              onClose={this.handleAuthClose}
              currentUser={currentUser}
              onLogin={this.handleLogin}
              onRegister={this.handleRegister}
              onUpdatePassword={this.handleUpdatePassword}
              onLogout={this.handleLogout}
            />
            <DocumentNavigator
              open={documentNavigatorOpen}
              pinned={documentNavigatorPinned}
              userId={documentNavigatorUserId}
              isRemoteMode={this.isRemoteMode}
              content={content}
              onClose={this.handleDocumentNavigatorClose}
              onPinnedChange={this.handleDocumentNavigatorPinnedChange}
            />
          </div>
        )}
      </appContext.Consumer>
    );
  }
}

export default App;
