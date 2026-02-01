import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Table, Button, Input, message} from "antd";
import {ReloadOutlined} from "@ant-design/icons";
import {getDataStore} from "../../data/store";
import {BrowserDataStore} from "../../data/store/browser/BrowserDataStore";
import {DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_UUID} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class CategoryManageDialog extends Component {
  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      categories: [],
      loading: false,
      renameVisible: false,
      renameUuid: null,
      renameValue: "",
      createVisible: false,
      createValue: "",
    };
  }

  componentDidMount() {
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

  getRuntimeUserId() {
    if (typeof window === "undefined") return 0;
    return window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__ || 0;
  }

  shouldCacheRemote() {
    return this.resolveDataStoreMode() === "remote" && this.getRuntimeUserId() > 0;
  }

  getCacheStore() {
    if (!this.shouldCacheRemote()) return null;
    const uid = this.getRuntimeUserId();
    return new BrowserDataStore(Number(uid) || 0);
  }

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

  loadCategories = async () => {
    if (this.state.loading) {
      return;
    }
    this.setState({loading: true});
    try {
      const uid =
        (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
      const store = getDataStore("remote", Number(uid) || 0);
      const categories = await store.listCategoriesWithCount();
      await this.cacheCategories(categories);
      this.setState({categories});
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
    if (category.category_id === DEFAULT_CATEGORY_UUID) {
      message.warning("默认目录不支持重命名");
      return;
    }
    this.setState({
      renameVisible: true,
      renameUuid: category.category_id,
      renameValue: category.name || "",
    });
  };

  closeRename = () => {
    this.setState({renameVisible: false, renameUuid: null, renameValue: ""});
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
    try {
      const uid =
        (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
      const store = getDataStore("remote", Number(uid) || 0);
      const created = await store.createCategory(nextName);
      await this.cacheCategories([created]);
      message.success("新建目录成功");
      this.closeCreate();
      this.loadCategories();
    } catch (e) {
      console.error(e);
      message.error("新建目录失败");
    }
  };

  handleRenameOk = async () => {
    const {renameUuid, renameValue, categories} = this.state;
    const nextName = String(renameValue || "").trim();
    if (!renameUuid) {
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
    if (categories.some((item) => item.name === nextName && item.category_id !== renameUuid)) {
      message.error("目录名称已存在");
      return;
    }
    try {
      const uid =
        (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
      const store = getDataStore("remote", Number(uid) || 0);
      await store.renameCategory(renameUuid, nextName);
      message.success("重命名成功");
      if (this.props.content.documentCategoryUuid === renameUuid) {
        this.props.content.setDocumentCategoryName(nextName);
      }
      await this.cacheCategories([{category_id: renameUuid, name: nextName, source: "remote", uid}]);
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
    if (category.category_id === DEFAULT_CATEGORY_UUID) {
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
      onOk: () => this.deleteCategory(category),
    });
  };

  deleteCategory = async (category) => {
    try {
      const uid =
        (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
      const store = getDataStore("remote", Number(uid) || 0);
      await store.deleteCategory(category.category_id, {reassignTo: DEFAULT_CATEGORY_UUID});
      if (this.props.content.documentCategoryUuid === category.category_id) {
        this.props.content.setDocumentCategory(DEFAULT_CATEGORY_UUID, DEFAULT_CATEGORY_NAME);
      }
      await this.cacheDeleteCategory(category.category_id);
      message.success("删除成功");
      this.loadCategories();
    } catch (e) {
      console.error(e);
      message.error("删除失败");
    }
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
          const isDefault = record.category_id === DEFAULT_CATEGORY_UUID;
          return (
            <>
              <Button type="link" disabled={isDefault} onClick={() => this.openRename(record)} title="重命名">
                重命名
              </Button>
              <Button
                title="删除"
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
            <Button type="primary" onClick={this.openCreate} title="新建目录">
              新建目录
            </Button>
            <Button icon={<ReloadOutlined />} onClick={this.loadCategories} title="刷新" />
          </div>
          <Table
            rowKey="category_id"
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

  cacheCategories = async (categories) => {
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await Promise.all(
      categories.map((category) =>
        cache.upsertCategorySnapshot({
          ...category,
          source: "remote",
          uid: this.getRuntimeUserId(),
        }),
      ),
    );
  };

  cacheDeleteCategory = async (categoryUuid) => {
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await cache.deleteCategory(categoryUuid, {reassignTo: DEFAULT_CATEGORY_UUID});
  };
}

export default CategoryManageDialog;
