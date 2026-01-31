import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Input, Form, Select, message} from "antd";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {getDataStore} from "../../data/store";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

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
      categoryId: DEFAULT_CATEGORY_ID,
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
      this.setState({categoryId: DEFAULT_CATEGORY_ID});
      this.loadCategories();
    }
    this.wasOpen = isOpen;
  }

  getDataStore() {
    const uid =
      (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
    return getDataStore(undefined, Number(uid) || 0);
  }

  loadCategories = async () => {
    try {
      const categories = await this.getDataStore().listCategories();
      this.setState({categories});
      return categories;
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

    try {
      const now = new Date();
      const categoryId = this.state.categoryId || DEFAULT_CATEGORY_ID;
      const documentId = await this.getDataStore().createDocument(
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
