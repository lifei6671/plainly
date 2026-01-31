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
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

const DocumentID = 1;

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

  resolveDataStoreMode() {
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
  }

  getRuntimeUserId = () => {
    if (typeof window === "undefined") return 0;
    return window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__ || 0;
  };

  getRemoteStore = () => {
    if (this.resolveDataStoreMode() !== "remote") return null;
    const uid = this.getRuntimeUserId();
    if (!uid) return null;
    return getDataStore("remote", Number(uid) || 0);
  };

  async componentDidMount() {
    await this.initIndexDB();
    await this.initArticleDB();
  }

  componentDidUpdate(prevProps) {
    const prevDocumentId = this.getDocumentId(prevProps);
    const currentDocumentId = this.getDocumentId();
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

  getDocumentId = (props = this.props) => {
    if (props.content && props.content.documentId != null) {
      return props.content.documentId;
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
    const documentId = this.getDocumentId();
    if (!documentId) {
      return;
    }
    if (Content.trim() !== "") {
      const now = new Date();
      const document = {
        Content,
        DocumentID: documentId,
        SaveTime: now,
      };
      const setLocalDocumentMethod = isRecent && this.state.documents.length > 0 ? setLocalDraft : setLocalDocuments;
      await setLocalDocumentMethod(this.db, this.state.documents, document);
      await this.overrideLocalDocuments(documentId);
      await this.saveArticleContent(documentId, Content, now);
      const remoteStore = this.getRemoteStore();
      if (remoteStore) {
        try {
          await remoteStore.saveDocumentContent(documentId, Content, now);
        } catch (e) {
          console.error(e);
        }
      }
      this.props.content.setDocumentUpdatedAt(now);
    }
  };

  saveArticleContent = async (documentId, content, updatedAt) => {
    if (!documentId) {
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
      const req = metaStore.get(documentId);
      req.onsuccess = () => {
        const current = req.result;
        const payload = {
          document_id: documentId,
          name: (current && current.name) || this.props.content.documentName || "未命名.md",
          charCount: countVisibleChars(content || ""),
          category:
            current && current.category != null
              ? current.category
              : this.props.content.documentCategoryId || DEFAULT_CATEGORY_ID,
          createdAt: (current && current.createdAt) || updatedAt,
          updatedAt,
        };
        metaStore.put(payload);
        contentStore.put({
          document_id: documentId,
          content,
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
        version: 4,
        storeName: "article_meta",
        storeOptions: {keyPath: "document_id", autoIncrement: true},
        storeInit: (objectStore, db, transaction) => {
          if (objectStore && !objectStore.indexNames.contains("name")) {
            objectStore.createIndex("name", "name", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("uid")) {
            objectStore.createIndex("uid", "uid", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("createdAt")) {
            objectStore.createIndex("createdAt", "createdAt", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("updatedAt")) {
            objectStore.createIndex("updatedAt", "updatedAt", {unique: false});
          }
          if (objectStore && !objectStore.indexNames.contains("category")) {
            objectStore.createIndex("category", "category", {unique: false});
          }
          if (db && !db.objectStoreNames.contains("article_content")) {
            const contentStore = db.createObjectStore("article_content", {keyPath: "document_id"});
            contentStore.createIndex("uid", "uid", {unique: false});
          } else if (transaction && transaction.objectStoreNames.contains("article_content")) {
            const contentStore = transaction.objectStore("article_content");
            if (contentStore && !contentStore.indexNames.contains("uid")) {
              contentStore.createIndex("uid", "uid", {unique: false});
            }
          }
          if (db) {
            const shouldCreate = !db.objectStoreNames.contains("categories");
            let categoriesStore = null;
            if (shouldCreate) {
              categoriesStore = db.createObjectStore("categories", {keyPath: "id", autoIncrement: true});
            } else if (transaction && transaction.objectStoreNames.contains("categories")) {
              categoriesStore = transaction.objectStore("categories");
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("uid")) {
              categoriesStore.createIndex("uid", "uid", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("name")) {
              categoriesStore.createIndex("name", "name", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("createdAt")) {
              categoriesStore.createIndex("createdAt", "createdAt", {unique: false});
            }
            if (categoriesStore && !categoriesStore.indexNames.contains("updatedAt")) {
              categoriesStore.createIndex("updatedAt", "updatedAt", {unique: false});
            }
            if (shouldCreate && categoriesStore) {
              const now = new Date();
              categoriesStore.add({
                id: DEFAULT_CATEGORY_ID,
                name: DEFAULT_CATEGORY_NAME,
                createdAt: now,
                updatedAt: now,
                uid: 0,
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
        storeName: "customers",
        storeOptions: {keyPath: "id", autoIncrement: true},
        storeInit: (objectStore) => {
          objectStore.createIndex("DocumentID", "DocumentID", {unique: false});
          objectStore.createIndex("SaveTime", "SaveTime", {unique: false});
        },
      });
      this.db = await indexDB.init();

      const documentId = this.getDocumentId();
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
  async overrideLocalDocuments(documentID) {
    const localDocuments = await getLocalDocuments(this.db, +documentID);
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
            documentID={this.getDocumentId()}
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
  documentID: DocumentID,
};

export default HistoryDialog;
