import React, {Component} from "react";
import CodeMirror from "@uiw/react-codemirror";
import "codemirror/addon/search/searchcursor";
import "codemirror/keymap/sublime";
import "codemirror/mode/markdown/markdown";
import "antd/dist/antd.css";
import {observer, inject} from "mobx-react";
import classnames from "classnames";
import throttle from "lodash.throttle";

import Dialog from "./layout/Dialog";
import Navbar from "./layout/Navbar";
import Sidebar from "./layout/Sidebar";
import StyleEditor from "./layout/StyleEditor";
import EditorMenu from "./layout/EditorMenu";
import SearchBox from "./component/SearchBox";

import "./App.css";
import "./utils/mdMirror.css";

import {
  LAYOUT_ID,
  BOX_ID,
  IMAGE_HOSTING_NAMES,
  IMAGE_HOSTING_TYPE,
  MJX_DATA_FORMULA,
  MJX_DATA_FORMULA_TYPE,
  DEFAULT_CATEGORY_NAME,
  DEFAULT_CATEGORY_UUID,
} from "./utils/constant";
import {countVisibleChars, markdownParser, markdownParserWechat, updateMathjax} from "./utils/helper";
import pluginCenter from "./utils/pluginCenter";
import appContext from "./utils/appContext";
import {uploadAdaptor} from "./utils/imageHosting";
import bindHotkeys, {betterTab, rightClick} from "./utils/hotkey";
import AuthModal from "./component/Auth/AuthModal";
import {getConfigSync, setConfigSync} from "./utils/configStore";
import {Button} from "antd";
import {BrowserDataStore} from "./data/store/browser/BrowserDataStore";
import {getDataStore} from "./data/store";
import {markIndexDirty, scheduleIndexRebuild} from "./search";

const SESSION_FLAG_COOKIE = "plainly_session";

@inject("content")
@inject("navbar")
@inject("view")
@inject("dialog")
@inject("imageHosting")
@observer
class App extends Component {
  constructor(props) {
    super(props);
    this.focus = false;
    this.scale = 1;
    this.state = {
      authVisible: false,
      currentUser: null,
    };
    this.handleUpdateMathjax = throttle(updateMathjax, 1500);
    this.handleUpdateMermaid = throttle(this.updateMermaid, 800);
    this.isRemoteMode = this.resolveDataStoreMode() === "remote";
    this.apiBase =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_BASE) ||
      (typeof process !== "undefined" && process.env?.VITE_API_BASE) ||
      "/api";
  }

  mapUser = (u) => {
    if (!u) return null;
    return {
      id: u.id,
      account: u.account || u.username,
      username: u.username || u.account,
    };
  };

  setRuntimeUser = (user) => {
    if (typeof window !== "undefined") {
      if (user && user.id) {
        window.__DATA_STORE_USER_ID__ = user.id;
        window.__CURRENT_USER_ID__ = user.id;
      } else {
        window.__DATA_STORE_USER_ID__ = 0;
        window.__CURRENT_USER_ID__ = 0;
      }
    }
  };

  getRuntimeUserId = () => {
    if (typeof window === "undefined") return 0;
    return window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__ || 0;
  };

  hasSessionCookie = () => {
    if (typeof document === "undefined") return false;
    return document.cookie.split(";").some((item) => item.trim().startsWith(`${SESSION_FLAG_COOKIE}=`));
  };

  syncLocalToRemote = async (user) => {
    if (!this.isRemoteMode || !user || !user.id) return;
    try {
      const localStore = new BrowserDataStore(0);
      await localStore.init();
      const remoteStore = getDataStore("remote", Number(user.id) || 0);
      const localCategories = await localStore.listCategories();
      const categoryUuidMap = new Map();
      const categoryItems = localCategories
        .filter((category) => category && category.category_id !== DEFAULT_CATEGORY_UUID)
        .map((category) => ({
          name: category.name,
          category_id: category.category_id,
          source: "local",
          version: category.version ?? 1,
        }));
      if (categoryItems.length > 0) {
        try {
          const result = await remoteStore.batchCreateCategories(categoryItems);
          const items = (result && result.items) || [];
          for (const item of items) {
            const clientId = item?.client_id;
            const created = item?.category;
            if (!clientId || !created || !created.category_id) continue;
            categoryUuidMap.set(clientId, created.category_id);
            if (created.category_id !== clientId) {
              await localStore.remapCategoryUuid(clientId, created.category_id);
              if (this.props.content.documentCategoryUuid === clientId) {
                this.props.content.setDocumentCategory(created.category_id, created.name || DEFAULT_CATEGORY_NAME);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }

      const localDocuments = await localStore.listAllDocuments();
      const documentItems = await Promise.all(
        localDocuments
          .filter((doc) => doc && doc.document_id)
          .map(async (doc) => {
            const content = await localStore.getDocumentContent(doc.document_id);
            const mappedCategoryUuid =
              categoryUuidMap.get(doc.category_id) || doc.category_id || DEFAULT_CATEGORY_UUID;
            return {
              meta: {
                document_id: doc.document_id,
                name: doc.name,
                category_id: mappedCategoryUuid,
                createdAt: doc.createdAt,
                updatedAt: doc.updatedAt,
                charCount: doc.charCount,
                source: "local",
                version: doc.version ?? 1,
              },
              content: content || "",
            };
          }),
      );
      const filteredDocs = documentItems.filter((item) => item && item.meta && item.meta.document_id);
      if (filteredDocs.length > 0) {
        try {
          const result = await remoteStore.batchCreateDocuments(filteredDocs);
          const items = (result && result.items) || [];
          for (const item of items) {
            const clientId = item?.client_id;
            const created = item?.document;
            if (!clientId || !created || !created.document_id) continue;
            if (created.document_id !== clientId) {
              await localStore.remapDocumentUuid(clientId, created.document_id);
              if (this.props.content.documentUuid === clientId) {
                this.props.content.setDocumentUuid(created.document_id);
              }
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  clearRemoteHistory = async (userId) => {
    if (!userId || typeof indexedDB === "undefined") return;
    await new Promise((resolve) => {
      const request = indexedDB.open("mdnice-local-history");
      request.onerror = () => resolve();
      request.onsuccess = (event) => {
        const db = event.target.result;
        if (!db || !db.objectStoreNames.contains("customers")) {
          resolve();
          return;
        }
        const tx = db.transaction(["customers"], "readwrite");
        const store = tx.objectStore("customers");
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = (cursorEvent) => {
          const cursor = cursorEvent.target.result;
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
    if (typeof window !== "undefined" && window.__DATA_STORE_MODE__) {
      return window.__DATA_STORE_MODE__;
    }
    if (typeof process !== "undefined" && process.env?.DATA_STORE_MODE) {
      return process.env.DATA_STORE_MODE;
    }
    return "browser";
  };

  componentDidMount() {
    document.addEventListener("fullscreenchange", this.solveScreenChange);
    document.addEventListener("webkitfullscreenchange", this.solveScreenChange);
    document.addEventListener("mozfullscreenchange", this.solveScreenChange);
    document.addEventListener("MSFullscreenChange", this.solveScreenChange);
    try {
      window.MathJax = {
        tex: {
          inlineMath: [["$", "$"]],
          displayMath: [["$$", "$$"]],
          tags: "ams",
        },
        svg: {
          fontCache: "none",
        },
        options: {
          renderActions: {
            addMenu: [0, "", ""],
            addContainer: [
              190,
              (doc) => {
                for (const math of doc.math) {
                  this.addContainer(math, doc);
                }
              },
              this.addContainer,
            ],
          },
        },
      };
      import("mathjax/es5/tex-svg-full")
        .then(() => {
          pluginCenter.mathjax = true;
        })
        .catch((error) => {
          console.log(error);
        });
    } catch (e) {
      console.log(e);
    }
    this.initMermaid();
    this.setEditorContent();
    this.setCustomImageHosting();
    this.loadCurrentUser();
  }

  componentDidUpdate() {
    if (pluginCenter.mathjax) {
      this.handleUpdateMathjax();
    }
    if (pluginCenter.mermaid) {
      this.handleUpdateMermaid();
    }
  }

  componentWillUnmount() {
    document.removeEventListener("fullscreenchange", this.solveScreenChange);
    document.removeEventListener("webkitfullscreenchange", this.solveScreenChange);
    document.removeEventListener("mozfullscreenchange", this.solveScreenChange);
    document.removeEventListener("MSFullscreenChange", this.solveScreenChange);
  }

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
    try {
      const user = await this.apiRequest("/auth/refresh", "POST");
      const mapped = this.mapUser(user?.user);
      this.setRuntimeUser(mapped);
      this.setState({currentUser: mapped});
    } catch (_e) {
      this.setRuntimeUser(null);
      this.setState({currentUser: null});
    }
  };

  handleAuthOpen = () => {
    this.setState({authVisible: true});
  };

  handleAuthClose = () => {
    this.setState({authVisible: false});
  };

  apiRequest = async (path, method = "GET", body) => {
    const res = await fetch(`${this.apiBase}${path}`, {
      method,
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

  setCurrentIndex(index) {
    this.index = index;
  }

  initMermaid = () => {
    import("mermaid")
      .then((module) => {
        const mermaid = module.default || module;
        this.mermaid = mermaid;
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
        });
        pluginCenter.mermaid = true;
        this.handleUpdateMermaid();
      })
      .catch((error) => {
        console.log(error);
      });
  };

  solveScreenChange = () => {
    const {isImmersiveEditing} = this.props.view;
    this.props.view.setImmersiveEditing(!isImmersiveEditing);
  };

  getInstance = (instance) => {
    if (instance) {
      this.props.content.setMarkdownEditor(instance.editor);
    }
  };

  handleScroll = () => {
    if (this.props.navbar.isSyncScroll) {
      const {markdownEditor} = this.props.content;
      const cmData = markdownEditor.getScrollInfo();
      const editorToTop = cmData.top;
      const editorScrollHeight = cmData.height - cmData.clientHeight;
      this.scale = (this.previewWrap.offsetHeight - this.previewContainer.offsetHeight + 55) / editorScrollHeight;
      if (this.index === 1) {
        this.previewContainer.scrollTop = editorToTop * this.scale;
      } else {
        this.editorTop = this.previewContainer.scrollTop / this.scale;
        markdownEditor.scrollTo(null, this.editorTop);
      }
    }
  };

  handleChange = (editor) => {
    if (this.focus) {
      const content = editor.getValue();
      this.props.content.setContent(content);
      this.props.onTextChange && this.props.onTextChange(content);
    }
  };

  handleFocus = () => {
    this.focus = true;
  };

  handleBlur = () => {
    this.focus = false;
  };

  getStyleInstance = (instance) => {
    if (instance) {
      this.styleEditor = instance.editor;
      this.styleEditor.on("keyup", (cm, e) => {
        if ((e.keyCode >= 65 && e.keyCode <= 90) || e.keyCode === 189) {
          cm.showHint(e);
        }
      });
    }
  };

  handleDrop = (instance, e) => {
    // e.preventDefault();
    // console.log(e.dataTransfer.files[0]);
    if (!(e.dataTransfer && e.dataTransfer.files)) {
      return;
    }
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      // console.log(e.dataTransfer.files[i]);
      uploadAdaptor({file: e.dataTransfer.files[i], content: this.props.content});
    }
  };

  handlePaste = (instance, e) => {
    if (e.clipboardData && e.clipboardData.files) {
      for (let i = 0; i < e.clipboardData.files.length; i++) {
        uploadAdaptor({file: e.clipboardData.files[i], content: this.props.content});
      }
    }
  };

  updateMermaid = () => {
    if (!this.mermaid || !this.previewWrap) {
      return;
    }
    const nodes = Array.from(this.previewWrap.querySelectorAll(".mermaid")).filter(
      (node) => !node.getAttribute("data-processed"),
    );
    if (!nodes.length) {
      return;
    }
    if (typeof this.mermaid.run === "function") {
      this.mermaid.run({nodes});
      return;
    }
    if (typeof this.mermaid.init === "function") {
      this.mermaid.init(undefined, nodes);
    }
  };

  addContainer(math, doc) {
    const tag = "span";
    const spanClass = math.display ? "span-block-equation" : "span-inline-equation";
    const cls = math.display ? "block-equation" : "inline-equation";
    math.typesetRoot.className = cls;
    math.typesetRoot.setAttribute(MJX_DATA_FORMULA, math.math);
    math.typesetRoot.setAttribute(MJX_DATA_FORMULA_TYPE, cls);
    math.typesetRoot = doc.adaptor.node(tag, {class: spanClass, style: "cursor:pointer"}, [math.typesetRoot]);
  }

  render() {
    const {codeNum, previewType} = this.props.navbar;
    const {isEditAreaOpen, isPreviewAreaOpen, isStyleEditorOpen, isImmersiveEditing} = this.props.view;
    const {isSearchOpen} = this.props.dialog;
    const {content, documentName, documentUpdatedAt} = this.props.content;
    const categoryName = this.props.content.documentCategoryName || DEFAULT_CATEGORY_NAME;
    const markdownLength = countVisibleChars(content || "");
    const lastSavedText = documentUpdatedAt ? new Date(documentUpdatedAt).toLocaleString() : "未保存";

    const parseHtml = codeNum === 0 ? markdownParserWechat.render(content) : markdownParser.render(content);

    const mdEditingClass = classnames({
      "nice-md-editing": !isImmersiveEditing,
      "nice-md-editing-immersive": isImmersiveEditing,
      "nice-md-editing-hide": !isEditAreaOpen,
    });

    const styleEditingClass = classnames({
      "nice-style-editing": true,
      "nice-style-editing-hide": isImmersiveEditing,
    });

    const richTextClass = classnames({
      "nice-marked-text": true,
      "nice-marked-text-pc": previewType === "pc",
      "nice-marked-text-hide": isImmersiveEditing || !isPreviewAreaOpen,
    });

    const richTextBoxClass = classnames({
      "nice-wx-box": true,
      "nice-wx-box-pc": previewType === "pc",
    });

    const textContainerClass = classnames({
      "nice-text-container": !isImmersiveEditing,
      "nice-text-container-immersive": isImmersiveEditing,
    });

    const statusBarClass = classnames({
      "nice-status-bar": true,
      "nice-status-bar-hide": isImmersiveEditing,
    });

    return (
      <appContext.Consumer>
        {({defaultTitle}) => (
          <div className="App">
            <Navbar title={defaultTitle} />
            <div className={textContainerClass}>
              <div id="nice-md-editor" className={mdEditingClass} onMouseOver={(e) => this.setCurrentIndex(1, e)}>
                {isSearchOpen && <SearchBox />}
                <CodeMirror
                  value={this.props.content.content}
                  options={{
                    theme: "md-mirror",
                    keyMap: "sublime",
                    mode: "text/x-markdown",
                    lineWrapping: true,
                    lineNumbers: false,
                    extraKeys: {
                      ...bindHotkeys(this.props.content, this.props.dialog),
                      Tab: betterTab,
                      RightClick: rightClick,
                    },
                  }}
                  onChange={this.handleChange}
                  onScroll={this.handleScroll}
                  onFocus={this.handleFocus}
                  onBlur={this.handleBlur}
                  onDrop={this.handleDrop}
                  onPaste={this.handlePaste}
                  ref={this.getInstance}
                />
              </div>
              <div id="nice-rich-text" className={richTextClass} onMouseOver={(e) => this.setCurrentIndex(2, e)}>
                <Sidebar />
                <div
                  id={BOX_ID}
                  className={richTextBoxClass}
                  onScroll={this.handleScroll}
                  ref={(node) => {
                    this.previewContainer = node;
                  }}
                >
                  <section
                    id={LAYOUT_ID}
                    data-tool="mdnice编辑器"
                    data-website="https://mdnice.disign.me"
                    dangerouslySetInnerHTML={{
                      __html: parseHtml,
                    }}
                    ref={(node) => {
                      this.previewWrap = node;
                    }}
                  />
                </div>
              </div>

              {isStyleEditorOpen && (
                <div id="nice-style-editor" className={styleEditingClass}>
                  <StyleEditor />
                </div>
              )}

              <Dialog />
              <EditorMenu />
            </div>
            <div className={statusBarClass}>
              {this.isRemoteMode ? (
                <>
                  <div className="nice-status-item nice-status-item-main">
                    <Button type="link" size="small" onClick={this.handleAuthOpen}>
                      {this.state.currentUser
                        ? `已登录：${this.state.currentUser.username || this.state.currentUser.account}`
                        : "未登录"}
                    </Button>
                    <b>归属目录: </b>
                    {categoryName}
                    &nbsp;
                    <b>文件名: </b>
                    {documentName || "未命名.md"}
                  </div>
                </>
              ) : (
                <div className="nice-status-item nice-status-item-main">
                  <b>离线模式</b>&nbsp;
                  <b>归属目录: </b>
                  {categoryName}
                  &nbsp;
                  <b>文件名: </b>
                  {documentName || "未命名.md"}
                </div>
              )}
              <div className="nice-status-item">
                <b>最后保存时间: </b>
                {lastSavedText}
              </div>
              <div className="nice-status-item">
                <b>字符数:</b>
                {markdownLength}
              </div>
            </div>
            <AuthModal
              visible={this.state.authVisible}
              onClose={this.handleAuthClose}
              currentUser={this.state.currentUser}
              onLogin={this.handleLogin}
              onRegister={this.handleRegister}
              onUpdatePassword={this.handleUpdatePassword}
              onLogout={this.handleLogout}
            />
          </div>
        )}
      </appContext.Consumer>
    );
  }
}

export default App;
