import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore} from "../../data/store";
import {BrowserDataStore} from "../../data/store/browser/BrowserDataStore";
import {DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_UUID} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class RenameFileDialog extends Component {
  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      name: "",
      categories: [],
      categoryUuid: DEFAULT_CATEGORY_UUID,
    };
  }

  componentDidMount() {
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

  getDataStore() {
    const uid =
      (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
    return getDataStore(Number(uid) || 0);
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
    return new BrowserDataStore(this.getRuntimeUserId());
  }

  openDialog = async () => {
    this.resetNameFromStore();
    const categories = await this.loadCategories();
    await this.loadCategoryFromStore(categories);
  };

  loadCategories = async () => {
    try {
      const categories = await this.getDataStore().listCategories();
      await this.cacheCategories(categories);
      this.setState({categories});
      return categories;
    } catch (e) {
      console.error(e);
      return [];
    }
  };

  normalizeCategoryInfo = (value, categories) => {
    const mapByUuid = new Map();
    const mapByName = new Map();
    const mapByLegacyId = new Map();
    categories.forEach((category) => {
      mapByUuid.set(category.category_id, category);
      if (typeof category.id === "number") {
        mapByLegacyId.set(category.id, category);
      }
      if (category.name) {
        mapByName.set(category.name, category);
      }
    });
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (mapByUuid.has(trimmed)) {
        const category = mapByUuid.get(trimmed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
      if (mapByName.has(trimmed)) {
        const category = mapByName.get(trimmed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && mapByLegacyId.has(parsed)) {
        const category = mapByLegacyId.get(parsed);
        return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
      }
    }
    if (typeof value === "number" && mapByLegacyId.has(value)) {
      const category = mapByLegacyId.get(value);
      return {uuid: category.category_id, name: category.name || DEFAULT_CATEGORY_NAME};
    }
    return {uuid: DEFAULT_CATEGORY_UUID, name: DEFAULT_CATEGORY_NAME};
  };

  loadCategoryFromStore = async (categories = this.state.categories) => {
    const {documentUuid} = this.props.content;
    if (!documentUuid) {
      this.setState({categoryUuid: DEFAULT_CATEGORY_UUID});
      return;
    }
    try {
      const meta = await this.getDataStore().getDocumentMeta(documentUuid);
      const normalized = this.normalizeCategoryInfo(meta ? meta.category_id || meta.category : null, categories);
      this.setState({categoryUuid: normalized.uuid});
      this.props.content.setDocumentCategory(normalized.uuid, normalized.name);
    } catch (e) {
      console.error(e);
      this.setState({categoryUuid: DEFAULT_CATEGORY_UUID});
    }
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

  handleOk = async () => {
    const fileName = this.buildFileName(this.state.name);
    if (!fileName) {
      message.error("请输入文件名称");
      return;
    }
    const {documentUuid} = this.props.content;
    if (!documentUuid) {
      message.error("未找到当前文档");
      return;
    }
    try {
      const categoryUuid = this.state.categoryUuid || DEFAULT_CATEGORY_UUID;
      await this.getDataStore().updateDocumentMeta(documentUuid, {
        name: fileName,
        category_id: categoryUuid,
        updatedAt: new Date(),
      });
      const category = this.state.categories.find((item) => item.category_id === categoryUuid);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentCategory(categoryUuid, category ? category.name : DEFAULT_CATEGORY_NAME);
      await this.cacheUpdatedDocument(documentUuid, fileName, categoryUuid);
      this.props.dialog.setRenameFileOpen(false);
      message.success("重命名成功！");
      try {
        await markIndexDirty();
        scheduleIndexRebuild();
      } catch (err) {
        console.error(err);
      }
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
            value={this.state.categoryUuid}
            onChange={(value) => this.setState({categoryUuid: value})}
            placeholder="请选择目录"
          >
            {this.state.categories.map((category) => (
              <Select.Option key={category.category_id || category.id} value={category.category_id || category.id}>
                {category.name || DEFAULT_CATEGORY_NAME}
              </Select.Option>
            ))}
          </Select>
        </Form.Item>
      </Modal>
    );
  }

  cacheUpdatedDocument = async (documentUuid, name, categoryUuid) => {
    if (!documentUuid) return;
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await cache.upsertDocumentSnapshot({
      document_id: documentUuid,
      name,
      category_id: categoryUuid,
      updatedAt: new Date(),
      createdAt: new Date(),
      source: "remote",
      uid: this.getRuntimeUserId(),
    });
  };

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
}

export default RenameFileDialog;
