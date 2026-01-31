import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore} from "../../data/store";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

@inject("dialog")
@inject("content")
@observer
class RenameFileDialog extends Component {
  dataStore = getDataStore();

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

  loadCategories = async () => {
    try {
      const categories = await this.dataStore.listCategories();
      this.setState({categories});
      return categories;
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
    try {
      const meta = await this.dataStore.getDocumentMeta(documentId);
      const normalized = this.normalizeCategoryInfo(meta ? meta.category : null, categories);
      this.setState({categoryId: normalized.id});
      this.props.content.setDocumentCategory(normalized.id, normalized.name);
    } catch (e) {
      console.error(e);
      this.setState({categoryId: DEFAULT_CATEGORY_ID});
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
    const {documentId} = this.props.content;
    if (!documentId) {
      message.error("未找到当前文档");
      return;
    }
    try {
      const categoryId = this.state.categoryId || DEFAULT_CATEGORY_ID;
      await this.dataStore.updateDocumentMeta(documentId, {
        name: fileName,
        category: categoryId,
        updatedAt: new Date(),
      });
      const category = this.state.categories.find((item) => item.id === categoryId);
      this.props.content.setDocumentName(fileName);
      this.props.content.setDocumentCategory(categoryId, category ? category.name : DEFAULT_CATEGORY_NAME);
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
