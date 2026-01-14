import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import IndexDB from "../LocalHistory/indexdb";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class NewFileDialog extends Component {
  db = null;

  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      name: "",
      categories: [],
      categoryId: DEFAULT_CATEGORY_ID,
    };
  }

  componentDidMount() {
    this.initIndexDB();
    this.wasOpen = this.props.dialog.isNewFileOpen;
    if (this.wasOpen) {
      this.loadCategories();
    }
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isNewFileOpen;
    if (isOpen && !this.wasOpen) {
      this.setState({categoryId: DEFAULT_CATEGORY_ID});
      this.loadCategories();
    }
    this.wasOpen = isOpen;
  }

  initIndexDB = async () => {
    try {
      const indexDB = new IndexDB({
        name: "articles",
        version: 3,
        storeName: "article_meta",
        storeOptions: {keyPath: "document_id", autoIncrement: true},
        storeInit: (objectStore, db, transaction) => {
          if (objectStore && !objectStore.indexNames.contains("name")) {
            objectStore.createIndex("name", "name", {unique: false});
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
            db.createObjectStore("article_content", {keyPath: "document_id"});
          }
          if (db) {
            const shouldCreate = !db.objectStoreNames.contains("categories");
            let categoriesStore = null;
            if (shouldCreate) {
              categoriesStore = db.createObjectStore("categories", {keyPath: "id", autoIncrement: true});
            } else if (transaction && transaction.objectStoreNames.contains("categories")) {
              categoriesStore = transaction.objectStore("categories");
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
              });
            }
          }
        },
      });
      this.db = await indexDB.init();
    } catch (e) {
      console.error(e);
    }
  };

  ensureDefaultCategory = async () => {
    if (!this.db || !this.db.objectStoreNames.contains("categories")) {
      return null;
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["categories"], "readwrite");
      const store = transaction.objectStore("categories");
      const request = store.get(DEFAULT_CATEGORY_ID);
      request.onsuccess = () => {
        if (request.result) {
          resolve(request.result);
          return;
        }
        const now = new Date();
        const payload = {
          id: DEFAULT_CATEGORY_ID,
          name: DEFAULT_CATEGORY_NAME,
          createdAt: now,
          updatedAt: now,
        };
        const addReq = store.add(payload);
        addReq.onsuccess = () => resolve(payload);
        addReq.onerror = () => resolve(payload);
      };
      request.onerror = (event) => reject(event);
    });
  };

  fetchCategories = () => {
    if (!this.db || !this.db.objectStoreNames.contains("categories")) {
      return Promise.resolve([]);
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["categories"], "readonly");
      const store = transaction.objectStore("categories");
      const items = [];
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          items.push(cursor.value);
          cursor.continue();
        } else {
          resolve(items);
        }
      };
      request.onerror = (event) => reject(event);
    });
  };

  getTimeValue = (value) => {
    if (value instanceof Date) {
      return value.getTime();
    }
    if (value == null) {
      return 0;
    }
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  };

  loadCategories = async () => {
    try {
      if (!this.db) {
        await this.initIndexDB();
      }
      if (!this.db) {
        return [];
      }
      await this.ensureDefaultCategory();
      const categories = await this.fetchCategories();
      const sorted = categories.sort((a, b) => {
        if (a.id === DEFAULT_CATEGORY_ID) {
          return -1;
        }
        if (b.id === DEFAULT_CATEGORY_ID) {
          return 1;
        }
        return this.getTimeValue(a.createdAt) - this.getTimeValue(b.createdAt);
      });
      this.setState({categories: sorted});
      return sorted;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  normalizeName = (name) => {
    const trimmed = name.trim();
    if (!trimmed) {
      return "";
    }
    if (trimmed.toLowerCase().endsWith(".md")) {
      return trimmed.slice(0, -3);
    }
    return trimmed;
  };

  buildFileName = (name) => {
    const normalized = this.normalizeName(name);
    if (!normalized) {
      return "";
    }
    return `${normalized}.md`;
  };

  saveArticle = (meta, content) => {
    if (!this.db) {
      return Promise.reject(new Error("indexeddb not ready"));
    }
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["article_meta", "article_content"], "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const contentStore = transaction.objectStore("article_content");
      let documentId = null;
      const req = metaStore.add(meta);
      req.onsuccess = (event) => {
        documentId = event.target.result;
        contentStore.put({
          document_id: documentId,
          content,
        });
      };
      req.onerror = (event) => reject(event);
      transaction.oncomplete = () => resolve(documentId);
      transaction.onerror = (event) => reject(event);
    });
  };

  clearEditor = () => {
    const {markdownEditor} = this.props.content;
    this.props.content.setContent("");
    if (markdownEditor) {
      markdownEditor.setValue("");
      markdownEditor.focus();
    }
  };

  handleOk = async () => {
    const fileName = this.buildFileName(this.state.name);
    if (!fileName) {
      message.error("请输入文件名称");
      return;
    }
    if (!this.db) {
      await this.initIndexDB();
    }
    if (!this.db) {
      message.error("初始化数据库失败");
      return;
    }

    try {
      const now = new Date();
      const categoryId = this.state.categoryId || DEFAULT_CATEGORY_ID;
      const documentId = await this.saveArticle(
        {
          name: fileName,
          charCount: 0,
          category: categoryId,
          createdAt: now,
          updatedAt: now,
        },
        "",
      );
      if (documentId != null) {
        this.props.content.setDocumentId(documentId);
      }
      const category = this.state.categories.find((item) => item.id === categoryId);
      this.props.content.setDocumentCategory(categoryId, category ? category.name : DEFAULT_CATEGORY_NAME);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentUpdatedAt(now);
      this.clearEditor();
      this.setState({name: "", categoryId: DEFAULT_CATEGORY_ID});
      this.props.dialog.setNewFileOpen(false);
      message.success("新建文件成功！");
      try {
        await markIndexDirty();
        scheduleIndexRebuild();
      } catch (e) {
        console.error(e);
      }
    } catch (e) {
      console.error(e);
      message.error("新建文件失败");
    }
  };

  handleCancel = () => {
    this.setState({name: "", categoryId: DEFAULT_CATEGORY_ID});
    this.props.dialog.setNewFileOpen(false);
  };

  handleChange = (e) => {
    const value = this.normalizeName(e.target.value);
    this.setState({name: value});
  };

  render() {
    return (
      <Modal
        title="新建文件"
        okText="确认"
        cancelText="取消"
        visible={this.props.dialog.isNewFileOpen}
        onOk={this.handleOk}
        onCancel={this.handleCancel}
      >
        <Form.Item label="文件名称">
          <Input placeholder="请输入文件名称" value={this.state.name} onChange={this.handleChange} addonAfter=".md" />
        </Form.Item>
        <Form.Item label="目录">
          <Select
            value={this.state.categoryId}
            onChange={(value) => this.setState({categoryId: value})}
            placeholder="请选择目录"
          >
            {this.state.categories.map((category) => (
              <Select.Option key={category.id} value={category.id}>
                {category.name || DEFAULT_CATEGORY_NAME}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Modal>
    );
  }
}

export default NewFileDialog;
