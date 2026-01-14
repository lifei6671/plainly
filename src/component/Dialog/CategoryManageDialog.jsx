import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Table, Button, Input, message} from "antd";
import IndexDB from "../LocalHistory/indexdb";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class CategoryManageDialog extends Component {
  db = null;

  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      categories: [],
      loading: false,
      renameVisible: false,
      renameId: null,
      renameValue: "",
      createVisible: false,
      createValue: "",
    };
  }

  componentDidMount() {
    this.initIndexDB();
    this.wasOpen = this.props.dialog.isCategoryManageOpen;
    if (this.wasOpen) {
      this.loadCategories();
    }
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isCategoryManageOpen;
    if (isOpen && !this.wasOpen) {
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

  formatTime = (value) => {
    if (!value) {
      return "-";
    }
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "-";
    }
    return date.toLocaleString();
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

  getCategoryStats = (categories) => {
    if (!this.db || !this.db.objectStoreNames.contains("article_meta")) {
      return Promise.resolve(
        categories.map((category) => ({
          ...category,
          count: 0,
        })),
      );
    }
    const categoriesById = new Map();
    const categoriesByName = new Map();
    categories.forEach((category) => {
      categoriesById.set(category.id, category);
      if (category.name) {
        categoriesByName.set(category.name, category.id);
      }
    });
    const counts = new Map();
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["article_meta"], "readwrite");
      const store = transaction.objectStore("article_meta");
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (!cursor) {
          return;
        }
        const record = cursor.value || {};
        const current = record.category;
        let nextCategoryId = DEFAULT_CATEGORY_ID;
        if (typeof current === "number") {
          nextCategoryId = categoriesById.has(current) ? current : DEFAULT_CATEGORY_ID;
        } else if (typeof current === "string" && current.trim()) {
          const trimmed = current.trim();
          if (categoriesByName.has(trimmed)) {
            nextCategoryId = categoriesByName.get(trimmed);
          } else {
            const parsed = Number(trimmed);
            nextCategoryId = categoriesById.has(parsed) ? parsed : DEFAULT_CATEGORY_ID;
          }
        }
        if (current !== nextCategoryId) {
          cursor.update({...record, category: nextCategoryId});
        }
        counts.set(nextCategoryId, (counts.get(nextCategoryId) || 0) + 1);
        cursor.continue();
      };
      request.onerror = (event) => reject(event);
      transaction.oncomplete = () => {
        const enriched = categories.map((category) => ({
          ...category,
          count: counts.get(category.id) || 0,
        }));
        resolve(enriched);
      };
      transaction.onerror = (event) => reject(event);
    });
  };

  loadCategories = async () => {
    if (this.state.loading) {
      return;
    }
    this.setState({loading: true});
    try {
      if (!this.db) {
        await this.initIndexDB();
      }
      if (!this.db) {
        message.error("初始化数据库失败");
        return;
      }
      await this.ensureDefaultCategory();
      const categories = await this.fetchCategories();
      const enriched = await this.getCategoryStats(categories);
      const sorted = enriched.sort((a, b) => {
        if (a.id === DEFAULT_CATEGORY_ID) {
          return -1;
        }
        if (b.id === DEFAULT_CATEGORY_ID) {
          return 1;
        }
        return this.getTimeValue(a.createdAt) - this.getTimeValue(b.createdAt);
      });
      this.setState({categories: sorted});
    } catch (e) {
      console.error(e);
      message.error("加载目录失败");
    } finally {
      this.setState({loading: false});
    }
  };

  openRename = (category) => {
    if (!category) {
      return;
    }
    if (category.id === DEFAULT_CATEGORY_ID) {
      message.warning("默认目录不支持重命名");
      return;
    }
    this.setState({
      renameVisible: true,
      renameId: category.id,
      renameValue: category.name || "",
    });
  };

  closeRename = () => {
    this.setState({renameVisible: false, renameId: null, renameValue: ""});
  };

  openCreate = () => {
    this.setState({createVisible: true, createValue: ""});
  };

  closeCreate = () => {
    this.setState({createVisible: false, createValue: ""});
  };

  handleCreateOk = async () => {
    const nextName = String(this.state.createValue || "").trim();
    if (!nextName) {
      message.error("请输入目录名称");
      return;
    }
    if (nextName === DEFAULT_CATEGORY_NAME) {
      message.error("目录名称已存在");
      return;
    }
    if (this.state.categories.some((item) => item.name === nextName)) {
      message.error("目录名称已存在");
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
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["categories"], "readwrite");
        const store = transaction.objectStore("categories");
        const now = new Date();
        store.add({
          name: nextName,
          createdAt: now,
          updatedAt: now,
        });
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event);
      });
      message.success("新建目录成功");
      this.closeCreate();
      this.loadCategories();
    } catch (e) {
      console.error(e);
      message.error("新建目录失败");
    }
  };

  handleRenameOk = async () => {
    const {renameId, renameValue, categories} = this.state;
    const nextName = String(renameValue || "").trim();
    if (!renameId) {
      return;
    }
    if (!nextName) {
      message.error("请输入目录名称");
      return;
    }
    if (nextName === DEFAULT_CATEGORY_NAME) {
      message.error("目录名称已存在");
      return;
    }
    if (categories.some((item) => item.name === nextName && item.id !== renameId)) {
      message.error("目录名称已存在");
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
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction(["categories"], "readwrite");
        const store = transaction.objectStore("categories");
        const request = store.get(renameId);
        request.onsuccess = () => {
          const current = request.result;
          if (!current) {
            resolve();
            return;
          }
          store.put({...current, name: nextName, updatedAt: new Date()});
        };
        request.onerror = (event) => reject(event);
        transaction.oncomplete = () => resolve();
        transaction.onerror = (event) => reject(event);
      });
      message.success("重命名成功");
      if (this.props.content.documentCategoryId === renameId) {
        this.props.content.setDocumentCategoryName(nextName);
      }
      this.closeRename();
      this.loadCategories();
    } catch (e) {
      console.error(e);
      message.error("重命名失败");
    }
  };

  handleDelete = (category) => {
    if (!category) {
      return;
    }
    if (category.id === DEFAULT_CATEGORY_ID) {
      message.warning("默认目录不可删除");
      return;
    }
    const hasFiles = category.count > 0;
    Modal.confirm({
      title: `确认删除目录“${category.name || ""}”？`,
      content: hasFiles ? "删除后文档将默认归属到“默认目录”中。" : null,
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      onOk: () => this.deleteCategory(category, hasFiles),
    });
  };

  deleteCategory = async (category, shouldMove) => {
    if (!this.db) {
      await this.initIndexDB();
    }
    if (!this.db) {
      message.error("初始化数据库失败");
      return;
    }
    await new Promise((resolve, reject) => {
      const transaction = this.db.transaction(["categories", "article_meta"], "readwrite");
      const categoryStore = transaction.objectStore("categories");
      const metaStore = transaction.objectStore("article_meta");
      categoryStore.delete(category.id);
      if (shouldMove) {
        const request = metaStore.openCursor();
        request.onsuccess = (event) => {
          const cursor = event.target.result;
          if (!cursor) {
            return;
          }
          const record = cursor.value || {};
          const current = record.category;
          if (current === category.id || current === category.name || Number(current) === category.id) {
            cursor.update({...record, category: DEFAULT_CATEGORY_ID});
          }
          cursor.continue();
        };
        request.onerror = (event) => reject(event);
      }
      transaction.oncomplete = () => {
        if (this.props.content.documentCategoryId === category.id) {
          this.props.content.setDocumentCategory(DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME);
        }
        message.success("删除成功");
        this.loadCategories();
        resolve();
      };
      transaction.onerror = (event) => {
        message.error("删除失败");
        reject(event);
      };
    });
  };

  render() {
    const columns = [
      {
        title: "目录名称",
        dataIndex: "name",
        key: "name",
        render: (text) => text || DEFAULT_CATEGORY_NAME,
      },
      {
        title: "文件数量",
        dataIndex: "count",
        key: "count",
        width: 120,
        render: (value) => (value != null ? value : 0),
      },
      {
        title: "创建时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 200,
        render: (value) => this.formatTime(value),
      },
      {
        title: "操作",
        key: "action",
        width: 180,
        render: (_, record) => {
          const isDefault = record.id === DEFAULT_CATEGORY_ID;
          return (
            <>
              <Button type="link" disabled={isDefault} onClick={() => this.openRename(record)}>
                重命名
              </Button>
              <Button
                type="link"
                style={isDefault ? undefined : {color: "#ff4d4f"}}
                disabled={isDefault}
                onClick={() => this.handleDelete(record)}
              >
                删除
              </Button>
            </>
          );
        },
      },
    ];

    return (
      <>
        <Modal
          title="目录管理"
          visible={this.props.dialog.isCategoryManageOpen}
          onCancel={() => this.props.dialog.setCategoryManageOpen(false)}
          footer={null}
          width={840}
        >
          <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
            <Button type="primary" onClick={this.openCreate}>
              新建目录
            </Button>
            <Button icon="reload" onClick={this.loadCategories} />
          </div>
          <Table
            rowKey="id"
            columns={columns}
            dataSource={this.state.categories}
            loading={this.state.loading}
            pagination={false}
          />
        </Modal>
        <Modal
          title="新建目录"
          visible={this.state.createVisible}
          okText="确认"
          cancelText="取消"
          onOk={this.handleCreateOk}
          onCancel={this.closeCreate}
        >
          <Input
            placeholder="请输入目录名称"
            value={this.state.createValue}
            onChange={(e) => this.setState({createValue: e.target.value})}
            onPressEnter={this.handleCreateOk}
          />
        </Modal>
        <Modal
          title="重命名目录"
          visible={this.state.renameVisible}
          okText="确认"
          cancelText="取消"
          onOk={this.handleRenameOk}
          onCancel={this.closeRename}
        >
          <Input
            placeholder="请输入目录名称"
            value={this.state.renameValue}
            onChange={(e) => this.setState({renameValue: e.target.value})}
            onPressEnter={this.handleRenameOk}
          />
        </Modal>
      </>
    );
  }
}

export default CategoryManageDialog;
