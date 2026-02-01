import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore, resolveDataStoreInfo, shouldCacheRemoteStore, REMOTE_SOURCE} from "../../data/store";
import {BrowserDataStore} from "../../data/store/browser/BrowserDataStore";
import {DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_UUID} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class NewFileDialog extends Component {
  wasOpen = false;

  constructor(props) {
    super(props);
    this.state = {
      name: "",
      categories: [],
      categoryUuid: DEFAULT_CATEGORY_UUID,
      isLoadingCategories: false,
      isSaving: false,
    };
  }

  componentDidMount() {
    this.wasOpen = this.props.dialog.isNewFileOpen;
    if (this.wasOpen) {
      this.loadCategories();
    }
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isNewFileOpen;
    if (isOpen && !this.wasOpen) {
      this.setState({categoryUuid: DEFAULT_CATEGORY_UUID});
      this.loadCategories();
    }
    this.wasOpen = isOpen;
  }

  getDataStore() {
    const uid =
      (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
    return getDataStore(Number(uid) || 0);
  }

  getRuntimeUserId() {
    const info = resolveDataStoreInfo();
    return info.userId || 0;
  }

  shouldCacheRemote() {
    return shouldCacheRemoteStore();
  }

  getCacheStore() {
    if (!this.shouldCacheRemote()) return null;
    return new BrowserDataStore(this.getRuntimeUserId());
  }

  loadCategories = async () => {
    this.setState({isLoadingCategories: true});
    try {
      const categories = await this.getDataStore().listCategories();
      await this.cacheCategories(categories);
      this.setState({categories});
      return categories;
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      this.setState({isLoadingCategories: false});
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

  clearEditor = () => {
    const {markdownEditor} = this.props.content;
    this.props.content.setContent("");
    if (markdownEditor) {
      markdownEditor.setValue("");
      markdownEditor.focus();
    }
  };

  handleOk = async () => {
    if (this.state.isSaving) {
      return;
    }
    const fileName = this.buildFileName(this.state.name);
    if (!fileName) {
      message.error("请输入文件名称");
      return;
    }

    try {
      this.setState({isSaving: true});
      const now = new Date();
      const categoryUuid = this.state.categoryUuid || DEFAULT_CATEGORY_UUID;
      const created = await this.getDataStore().createDocument(
        {
          name: fileName,
          charCount: 0,
          category_id: categoryUuid,
          createdAt: now,
          updatedAt: now,
        },
        "",
      );
      if (created && created.document_id) {
        this.props.content.setDocumentUuid(created.document_id);
      }
      const category = this.state.categories.find((item) => item.category_id === categoryUuid);
      this.props.content.setDocumentCategory(categoryUuid, category ? category.name : DEFAULT_CATEGORY_NAME);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentUpdatedAt(now);
      this.clearEditor();
      await this.cacheCreatedDocument(created);
      this.setState({name: "", categoryUuid: DEFAULT_CATEGORY_UUID});
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
    } finally {
      this.setState({isSaving: false});
    }
  };

  handleCancel = () => {
    this.setState({name: "", categoryUuid: DEFAULT_CATEGORY_UUID});
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
        confirmLoading={this.state.isSaving}
      >
        <Form.Item label="文件名称">
          <Input placeholder="请输入文件名称" value={this.state.name} onChange={this.handleChange} addonAfter=".md" />
        </Form.Item>
        <Form.Item label="目录">
          <Select
            value={this.state.categoryUuid}
            onChange={(value) => this.setState({categoryUuid: value})}
            placeholder={this.state.isLoadingCategories ? "加载中..." : "请选择目录"}
            loading={this.state.isLoadingCategories}
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

  cacheCreatedDocument = async (created) => {
    if (!created || !created.document_id) return;
    if (!this.shouldCacheRemote()) return;
    const cache = this.getCacheStore();
    if (!cache) return;
    await cache.init();
    await cache.upsertDocumentSnapshot({
      ...created,
      source: REMOTE_SOURCE,
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
          source: REMOTE_SOURCE,
          uid: this.getRuntimeUserId(),
        }),
      ),
    );
  };
}

export default NewFileDialog;
