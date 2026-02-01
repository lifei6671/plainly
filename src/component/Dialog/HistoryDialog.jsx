import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Empty, message} from "antd";
import LocalHistory from "../LocalHistory";
import {AutoSaveInterval, getLocalDocuments, setLocalDocuments, setLocalDraft} from "../LocalHistory/util";
import IndexDB from "../LocalHistory/indexdb";
import debouce from "lodash.debounce";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore} from "../../data/store";
import {countVisibleChars} from "../../utils/helper";
import {DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_ID} from "../../utils/constant";

const DocumentUUID = "";

const resolveDataStoreMode = () => {
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

const getRuntimeUserId = () => {
  if (typeof window === "undefined") return 0;
  return window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__ || 0;
};

@inject("dialog")
@inject("content")
@observer
class HistoryDialog extends Component {
  timer = null;

  db = null;

  articlesDb = null;

  constructor(props) {
    super(props);
    this.state = {
      documents: [],
    };
  }

  getRemoteStore = () => {
    if (resolveDataStoreMode() !== "remote") return null;
    const uid = getRuntimeUserId();
    if (!uid) return null;
    return getDataStore(Number(uid) || 0);
  };

  getHistorySource = () => {
    const uid = getRuntimeUserId();
    if (resolveDataStoreMode() === "remote" && uid > 0) {
      return "remote";
    }
    return "local";
  };

  async componentDidMount() {
    await this.initIndexDB();
    await this.initArticleDB();
  }

  componentDidUpdate(prevProps) {
    const prevDocumentId = this.getDocumentUuid(prevProps);
    const currentDocumentId = this.getDocumentUuid();
    if (prevDocumentId !== currentDocumentId && this.db) {
      if (currentDocumentId) {
        this.overrideLocalDocuments(currentDocumentId);
      } else {
        this.setState({documents: []});
      }
    }
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  get editor() {
    return this.props.content.markdownEditor;
  }

  getDocumentUuid = (props = this.props) => {
    if (props.content && props.content.documentUuid != null) {
      return props.content.documentUuid;
    }
    return props.documentID;
  };

  //
  // async UNSAFE_componentWillReceiveProps(nextProps) {
  //   // 文档 id 变更
  //   if (this.props.documentID !== nextProps.documentID && nextProps.documentID != null) {
  //     if (this.db) {
  //       await this.overrideLocalDocuments(nextProps.documentID);
  //     }
  //   }
  // }
  //

  closeDialog = () => {
    this.props.dialog.setHistoryOpen(false);
  };

  editLocalDocument = (content) => {
    this.props.content.setContent(content);
    message.success("恢复成功！");
    this.closeDialog();
  };

  autoSave = async (isRecent = false) => {
    const Content = this.props.content.markdownEditor.getValue();
    const documentUuid = this.getDocumentUuid();
    if (!documentUuid) {
      return;
    }
    if (Content.trim() !== "") {
      const now = new Date();
      const source = this.getHistorySource();
      const uid = getRuntimeUserId();
      const document = {
        Content,
        DocumentUUID: documentUuid,
        SaveTime: now,
        Source: source,
        Uid: uid,
      };
      const setLocalDocumentMethod = isRecent && this.state.documents.length > 0 ? setLocalDraft : setLocalDocuments;
      await setLocalDocumentMethod(this.db, this.state.documents, document);
      await this.overrideLocalDocuments(documentUuid);
      await this.saveArticleContent(documentUuid, Content, now);
      const remoteStore = this.getRemoteStore();
      if (remoteStore) {
        try {
          await remoteStore.saveDocumentContent(documentUuid, Content, now);
        } catch (e) {
          console.error(e);
        }
      }
      this.props.content.setDocumentUpdatedAt(now);
    }
  };

  saveArticleContent = async (documentUuid, content, updatedAt) => {
    if (!documentUuid) {
      return;
    }
    if (!this.articlesDb) {
      await this.initArticleDB();
    }
    if (!this.articlesDb) {
      return;
    }
    await new Promise((resolve, reject) => {
      const transaction = this.articlesDb.transaction(["article_meta", "article_content"], "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      const metaIndex = metaStore.index("document_id");
          const req = metaIndex.get(documentUuid);
          req.onsuccess = () => {
            const current = req.result;
            const source = this.getHistorySource();
            const uid = getRuntimeUserId();
            const payload = {
          document_id: documentUuid,
          name: (current && current.name) || this.props.content.documentName || "未命名.md",
          charCount: countVisibleChars(content || ""),
          category_id:
            current && current.category_id != null
              ? current.category_id
              : this.props.content.documentCategoryUuid || DEFAULT_CATEGORY_UUID,
          createdAt: (current && current.createdAt) || updatedAt,
          updatedAt,
          uid,
          source,
          version: current && current.version != null ? current.version + 1 : 1,
        };
        const resolvedId = current && current.document_id ? current.document_id : documentUuid;
        metaStore.put({
          ...payload,
          document_id: resolvedId,
        });
        contentStore.put({
          document_id: resolvedId,
          content,
          uid,
          source,
        });
      };
      req.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve();
      transaction.onerror = (event) => reject(event);
    });
    try {
      await markIndexDirty();
      scheduleIndexRebuild();
    } catch (e) {
      console.error(e);
    }
  };

  async initArticleDB() {
    try {
      const indexDB = new IndexDB({
        name: "articles",
        version: 6,
        storeName: "article_meta",
        storeOptions: {keyPath: "document_id", autoIncrement: false},
        storeInit: (objectStore, db, transaction) => {
          const safeCreateIndex = (store, name, keyPath, options) => {
            if (!store) return;
            try {
              if (!store.indexNames.contains(name)) {
                store.createIndex(name, keyPath, options);
              }
            } catch (_e) {
              // ignore duplicate/upgrade edge cases
            }
          };
          safeCreateIndex(objectStore, "name", "name", {unique: false});
          safeCreateIndex(objectStore, "document_id", "document_id", {unique: false});
          safeCreateIndex(objectStore, "uid", "uid", {unique: false});
          safeCreateIndex(objectStore, "source", "source", {unique: false});
          safeCreateIndex(objectStore, "createdAt", "createdAt", {unique: false});
          safeCreateIndex(objectStore, "updatedAt", "updatedAt", {unique: false});
          safeCreateIndex(objectStore, "category", "category", {unique: false});
          safeCreateIndex(objectStore, "category_id", "category_id", {unique: false});
          if (db && !db.objectStoreNames.contains("article_content")) {
            const contentStore = db.createObjectStore("article_content", {keyPath: "document_id"});
            safeCreateIndex(contentStore, "uid", "uid", {unique: false});
            safeCreateIndex(contentStore, "document_id", "document_id", {unique: false});
            safeCreateIndex(contentStore, "source", "source", {unique: false});
          } else if (transaction && transaction.objectStoreNames.contains("article_content")) {
            const contentStore = transaction.objectStore("article_content");
            safeCreateIndex(contentStore, "uid", "uid", {unique: false});
            safeCreateIndex(contentStore, "document_id", "document_id", {unique: false});
            safeCreateIndex(contentStore, "source", "source", {unique: false});
          }
          if (db) {
            const shouldCreate = !db.objectStoreNames.contains("categories");
            let categoriesStore = null;
            if (shouldCreate) {
              categoriesStore = db.createObjectStore("categories", {keyPath: "id", autoIncrement: true});
            } else if (transaction && transaction.objectStoreNames.contains("categories")) {
              categoriesStore = transaction.objectStore("categories");
            }
            safeCreateIndex(categoriesStore, "uid", "uid", {unique: false});
            safeCreateIndex(categoriesStore, "category_id", "category_id", {unique: false});
            safeCreateIndex(categoriesStore, "source", "source", {unique: false});
            safeCreateIndex(categoriesStore, "name", "name", {unique: false});
            safeCreateIndex(categoriesStore, "createdAt", "createdAt", {unique: false});
            safeCreateIndex(categoriesStore, "updatedAt", "updatedAt", {unique: false});
            if (shouldCreate && categoriesStore) {
              const now = new Date();
              categoriesStore.add({
                id: DEFAULT_CATEGORY_ID,
                category_id: DEFAULT_CATEGORY_UUID,
                name: DEFAULT_CATEGORY_NAME,
                createdAt: now,
                updatedAt: now,
                uid: 0,
                source: "local",
                version: 1,
              });
            }
          }
          if (db && !db.objectStoreNames.contains("users")) {
            const usersStore = db.createObjectStore("users", {keyPath: "id", autoIncrement: true});
            usersStore.createIndex("account", "account", {unique: true});
            const now = new Date();
            usersStore.put({
              id: 0,
              account: "local",
              registered_at: now,
              last_login_at: now,
              last_login_ip: "0.0.0.0",
              status: 1,
              updated_at: now,
            });
          }
        },
      });
      this.articlesDb = await indexDB.init();
    } catch (e) {
      console.error(e);
    }
  }

  async initIndexDB() {
    try {
      const indexDB = new IndexDB({
        name: "mdnice-local-history",
        version: 2,
        storeName: "customers",
        storeOptions: {keyPath: "id", autoIncrement: true},
        storeInit: (objectStore) => {
          if (!objectStore) return;
          const safeCreateIndex = (store, name, keyPath) => {
            try {
              if (!store.indexNames.contains(name)) {
                store.createIndex(name, keyPath, {unique: false});
              }
            } catch (_e) {
              // ignore duplicate/upgrade edge cases
            }
          };
          safeCreateIndex(objectStore, "DocumentID", "DocumentID");
          safeCreateIndex(objectStore, "DocumentUUID", "DocumentUUID");
          safeCreateIndex(objectStore, "SaveTime", "SaveTime");
          safeCreateIndex(objectStore, "Source", "Source");
          safeCreateIndex(objectStore, "Uid", "Uid");
        },
      });
      this.db = await indexDB.init();

      const documentId = this.getDocumentUuid();
      if (this.db && documentId) {
        await this.overrideLocalDocuments(documentId);
      }
      // 每隔一段时间自动保存
      this.timer = setInterval(async () => {
        await this.autoSave();
      }, AutoSaveInterval);
      // 每改变内容自动保存最近的一条
      this.editor.on &&
        this.editor.on(
          "change",
          debouce(async () => {
            await this.autoSave(true);
          }, 1000),
        );
    } catch (e) {
      console.error(e);
    }
  }

  // 刷新本地历史文档
  async overrideLocalDocuments(documentUuid) {
    const localDocuments = await getLocalDocuments(this.db, documentUuid);
    // console.log('refresh local',localDocuments);
    this.setState({
      documents: localDocuments,
    });
  }

  render() {
    return (
      <Modal
        className="nice-md-local-history"
        title="本地历史"
        centered
        width={1080}
        visible={this.props.dialog.isHistoryOpen}
        onCancel={this.closeDialog}
        footer={null}
      >
        {this.state.documents && this.state.documents.length > 0 ? (
          <LocalHistory
            content={this.props.content.content}
            documents={this.state.documents}
            documentID={this.getDocumentUuid()}
            onEdit={this.editLocalDocument}
            onCancel={this.closeDialog}
          />
        ) : (
          <Empty style={{width: "100%"}} description="暂无本地历史" />
        )}
      </Modal>
    );
  }
}

HistoryDialog.defaultProps = {
  documentID: DocumentUUID,
};

export default HistoryDialog;
