import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import IndexDB from "../LocalHistory/indexdb";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class RenameFileDialog extends Component {
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
    this.wasOpen = this.props.dialog.isRenameFileOpen;
    if (this.wasOpen) {
      this.openDialog();
    }
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isRenameFileOpen;
    if (isOpen && !this.wasOpen) {
      this.openDialog();
    }
    this.wasOpen = isOpen;
  }

  openDialog = async () => {
    this.resetNameFromStore();
    const categories = await this.loadCategories();
    await this.loadCategoryFromStore(categories);
  };

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

  normalizeCategoryInfo = (value, categories) => {
    const mapById = new Map();
    const mapByName = new Map();
    categories.forEach((category) => {
      mapById.set(category.id, category);
      if (category.name) {
        mapByName.set(category.name, category);
      }
    });
    if (typeof value === "number" && mapById.has(value)) {
      const category = mapById.get(value);
      return {id: category.id, name: category.name || DEFAULT_CATEGORY_NAME};
    }
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (mapByName.has(trimmed)) {
        const category = mapByName.get(trimmed);
        return {id: category.id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && mapById.has(parsed)) {
        const category = mapById.get(parsed);
        return {id: category.id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
    }
    return {id: DEFAULT_CATEGORY_ID, name: DEFAULT_CATEGORY_NAME};
  };

  loadCategoryFromStore = async (categories = this.state.categories) => {
    const {documentId} = this.props.content;
    if (!documentId) {
      this.setState({categoryId: DEFAULT_CATEGORY_ID});
      return;
    }
    if (!this.db) {
      await this.initIndexDB();
    }
    if (!this.db) {
      this.setState({categoryId: DEFAULT_CATEGORY_ID});
      return;
    }
    await new Promise((resolve) => {
      const transaction = this.db.transaction(["article_meta"], "readonly");
      const store = transaction.objectStore("article_meta");
      const request = store.get(documentId);
      request.onsuccess = () => {
        const current = request.result || {};
        const normalized = this.normalizeCategoryInfo(current.category, categories);
        this.setState({categoryId: normalized.id});
        this.props.content.setDocumentCategory(normalized.id, normalized.name);
        resolve();
      };
      request.onerror = () => {
        this.setState({categoryId: DEFAULT_CATEGORY_ID});
        resolve();
      };
    });
  };

  resetNameFromStore = () => {
    const currentName = this.props.content.documentName || "未命名.md";
    this.setState({name: this.normalizeName(currentName)});
  };

  normalizeName = (name) => {
    const trimmed = String(name || "").trim();
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

  updateDocumentName = async (documentId, name, categoryId) => {
    if (!this.db) {
      await this.initIndexDB();
    }
    if (!this.db) {
      message.error("初始化数据库失败");
      return;
    }
    await new Promise((resolve, reject) => {
      const stores = ["article_meta"];
      if (this.db.objectStoreNames.contains("articles")) {
        stores.push("articles");
      }
      const transaction = this.db.transaction(stores, "readwrite");
      const metaStore = transaction.objectStore("article_meta");
      const metaReq = metaStore.get(documentId);
      metaReq.onsuccess = () => {
        const current = metaReq.result || {document_id: documentId};
        metaStore.put({...current, name, category: categoryId});
        // Keep legacy store in sync for users who haven't migrated yet.
        if (stores.includes("articles")) {
          const legacyStore = transaction.objectStore("articles");
          const legacyReq = legacyStore.get(documentId);
          legacyReq.onsuccess = () => {
            if (legacyReq.result) {
              legacyStore.put({...legacyReq.result, name});
            }
          };
        }
      };
      metaReq.onerror = (event) => reject(event);
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

  handleOk = async () => {
    const fileName = this.buildFileName(this.state.name);
    if (!fileName) {
      message.error("请输入文件名称");
      return;
    }
    const {documentId} = this.props.content;
    if (!documentId) {
      message.error("未找到当前文档");
      return;
    }
    try {
      const categoryId = this.state.categoryId || DEFAULT_CATEGORY_ID;
      await this.updateDocumentName(documentId, fileName, categoryId);
      const category = this.state.categories.find((item) => item.id === categoryId);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentCategory(categoryId, category ? category.name : DEFAULT_CATEGORY_NAME);
      this.props.dialog.setRenameFileOpen(false);
      message.success("重命名成功！");
    } catch (e) {
      console.error(e);
      message.error("重命名失败");
    }
  };

  handleCancel = () => {
    this.props.dialog.setRenameFileOpen(false);
  };

  handleChange = (e) => {
    const value = this.normalizeName(e.target.value);
    this.setState({name: value});
  };

  render() {
    return (
      <Modal
        title="重命名"
        okText="确认"
        cancelText="取消"
        visible={this.props.dialog.isRenameFileOpen}
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

export default RenameFileDialog;
