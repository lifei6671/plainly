import React, {Component} from "react";
import {Button, Drawer, Empty, Modal, Spin, Tooltip, Tree, message} from "antd";
import {
  CloseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FolderOutlined,
  PushpinOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import {Category, DocumentMeta, getDataStore} from "../../data/store";
import {markIndexDirty, scheduleIndexRebuild} from "../../search";
import {DEFAULT_CATEGORY_NAME, DEFAULT_CATEGORY_UUID} from "../../utils/constant";
import {buildDocumentTree} from "./tree";
import "./DocumentNavigator.css";

type DocumentNavigatorProps = {
  open: boolean;
  pinned: boolean;
  userId: number;
  isRemoteMode: boolean;
  content: any;
  onClose: () => void;
  onPinnedChange: (nextPinned: boolean) => void;
};

type DocumentNavigatorState = {
  categories: Category[];
  documents: DocumentMeta[];
  expandedKeys: string[];
  loading: boolean;
  loadFailed: boolean;
};

const categoryKey = (categoryId: string) => `category:${categoryId}`;
const documentKey = (documentId: string) => `document:${documentId}`;
const normalizeDocumentId = (documentId: string) => String(documentId || "").replace(/-/g, "");
const getCollapsedHeight = () => ({height: 0, opacity: 0});
const getRealHeight = (node: HTMLElement) => ({height: node.scrollHeight, opacity: 1});
const getCurrentHeight = (node: HTMLElement) => ({height: node.offsetHeight});
const endOnHeightTransition = (_: HTMLElement, event: TransitionEvent & {deadline?: boolean}) =>
  event.deadline === true || event.propertyName === "height";
const treeMotion = {
  motionName: "nice-document-navigator-tree-motion",
  onAppearStart: getCollapsedHeight,
  onEnterStart: getCollapsedHeight,
  onAppearActive: getRealHeight,
  onEnterActive: getRealHeight,
  onLeaveStart: getCurrentHeight,
  onLeaveActive: getCollapsedHeight,
  onAppearEnd: endOnHeightTransition,
  onEnterEnd: endOnHeightTransition,
  onLeaveEnd: endOnHeightTransition,
  motionDeadline: 220,
};

export const getDocumentNavigatorStore = (userId: number) => getDataStore(userId);

export class DocumentNavigator extends Component<DocumentNavigatorProps, DocumentNavigatorState> {
  loadVersion = 0;

  constructor(props: DocumentNavigatorProps) {
    super(props);
    this.state = {
      categories: [],
      documents: [],
      expandedKeys: [],
      loading: false,
      loadFailed: false,
    };
  }

  componentDidMount() {
    if (this.isVisible(this.props)) {
      this.loadDocuments();
    }
  }

  componentDidUpdate(previousProps: DocumentNavigatorProps) {
    const wasVisible = this.isVisible(previousProps);
    const isVisible = this.isVisible(this.props);
    if (
      isVisible &&
      (!wasVisible || previousProps.userId !== this.props.userId || previousProps.isRemoteMode !== this.props.isRemoteMode)
    ) {
      this.loadDocuments();
    }
  }

  isVisible = (props: DocumentNavigatorProps) => props.open || props.pinned;

  loadDocuments = async () => {
    const loadVersion = ++this.loadVersion;
    this.setState({loading: true, loadFailed: false});
    try {
      const store = getDocumentNavigatorStore(this.props.userId);
      await store.init();
      const [categories, documents] = await Promise.all([store.listCategories(), store.listAllDocuments()]);
      if (loadVersion !== this.loadVersion) return;
      this.setState({
        categories,
        documents,
        expandedKeys: buildDocumentTree(categories, documents).map((item) =>
          categoryKey(item.category ? item.category.category_id : "uncategorized"),
        ),
        loading: false,
      });
    } catch (error) {
      if (loadVersion !== this.loadVersion) return;
      console.error(error);
      this.setState({loading: false, loadFailed: true});
      message.error("加载文档失败");
    }
  };

  handleExpand = (expandedKeys: string[]) => {
    this.setState({expandedKeys});
  };

  toggleCategory = (categoryId: string) => {
    const key = categoryKey(categoryId);
    this.setState((previousState) => ({
      expandedKeys: previousState.expandedKeys.includes(key)
        ? previousState.expandedKeys.filter((expandedKey) => expandedKey !== key)
        : [...previousState.expandedKeys, key],
    }));
  };

  handleClose = () => {
    if (this.props.pinned) {
      this.props.onPinnedChange(false);
    }
    this.props.onClose();
  };

  handlePinnedChange = () => {
    this.props.onPinnedChange(!this.props.pinned);
  };

  openDocument = async (document: DocumentMeta) => {
    try {
      const content = await getDocumentNavigatorStore(this.props.userId).getDocumentContent(document.document_id);
      const category = this.state.categories.find((item) => item.category_id === document.category_id);
      this.props.content.setDocumentUuid(document.document_id);
      this.props.content.setDocumentName(document.name || "未命名.md");
      this.props.content.setDocumentCategory(
        category ? category.category_id : DEFAULT_CATEGORY_UUID,
        category ? category.name : DEFAULT_CATEGORY_NAME,
      );
      this.props.content.setDocumentUpdatedAt(document.updatedAt || document.createdAt || 0);
      this.props.content.setContent(content);
      if (this.props.content.markdownEditor) {
        this.props.content.markdownEditor.setValue(content);
        this.props.content.markdownEditor.focus();
      }
      if (!this.props.pinned) {
        this.props.onClose();
      }
    } catch (error) {
      console.error(error);
      message.error("加载文档失败");
    }
  };

  deleteDocument = (document: DocumentMeta) => {
    if (normalizeDocumentId(document.document_id) === normalizeDocumentId(this.props.content.documentUuid)) {
      message.warning("当前正在编辑该文档，不能删除。");
      return;
    }
    Modal.confirm({
      title: "确认删除该文档？",
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      onOk: async () => {
        try {
          await getDocumentNavigatorStore(this.props.userId).deleteDocument(document.document_id);
          this.setState((previousState) => ({
            documents: previousState.documents.filter((item) => item.document_id !== document.document_id),
          }));
          message.success("删除成功");
          markIndexDirty()
            .then(scheduleIndexRebuild)
            .catch(console.error);
        } catch (error) {
          message.error("删除失败");
          throw error;
        }
      },
    });
  };

  renderDocumentTitle = (document: DocumentMeta) => {
    const isActive = normalizeDocumentId(document.document_id) === normalizeDocumentId(this.props.content.documentUuid);
    const documentName = document.name || "未命名.md";
    return (
      <div className={`nice-document-navigator-node nice-document-navigator-document-node${isActive ? " active" : ""}`}>
        <button
          type="button"
          className="nice-document-navigator-document-open"
          aria-label={`打开 ${documentName}`}
          onClick={() => this.openDocument(document)}
        >
          <FileTextOutlined />
          <Tooltip title={documentName} placement="right" mouseEnterDelay={0.3}>
            <span className="nice-document-navigator-node-label">{documentName}</span>
          </Tooltip>
        </button>
        <button
          type="button"
          className="nice-document-navigator-delete"
          aria-label={`删除 ${documentName}`}
          onClick={(event) => {
            event.stopPropagation();
            this.deleteDocument(document);
          }}
        >
          <DeleteOutlined />
        </button>
      </div>
    );
  };

  renderTree() {
    const treeData = buildDocumentTree(this.state.categories, this.state.documents).map((item) => {
      const categoryId = item.category ? item.category.category_id : "uncategorized";
      const isExpanded = this.state.expandedKeys.includes(categoryKey(categoryId));
      return {
        key: categoryKey(categoryId),
        title: (
          <div
            className="nice-document-navigator-node nice-document-navigator-category-node"
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            onClick={() => this.toggleCategory(categoryId)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                this.toggleCategory(categoryId);
              }
            }}
          >
            {isExpanded ? <FolderOpenOutlined /> : <FolderOutlined />}
            <span className="nice-document-navigator-node-label">
              {item.category ? item.category.name : "未分类"}
            </span>
          </div>
        ),
        children: item.documents.map((document) => ({
          key: documentKey(document.document_id),
          isLeaf: true,
          title: this.renderDocumentTitle(document),
        })),
      };
    });

    if (this.state.loading) {
      return <Spin className="nice-document-navigator-empty" />;
    }
    if (this.state.loadFailed) {
      return <Empty className="nice-document-navigator-empty" description="加载文档失败" />;
    }
    if (!this.state.categories.length && !this.state.documents.length) {
      return <Empty className="nice-document-navigator-empty" description="暂无文档" />;
    }
    return (
      <Tree
        className="nice-document-navigator-tree"
        showLine={false}
        selectable={false}
        blockNode
        expandedKeys={this.state.expandedKeys}
        onExpand={this.handleExpand}
        motion={treeMotion}
        treeData={treeData}
      />
    );
  }

  renderNavigator() {
    return (
      <div className="nice-document-navigator">
        <header className="nice-document-navigator-header">
          <div className="nice-document-navigator-title">
            <strong>文档</strong>
            <span className="nice-document-navigator-source">{this.props.isRemoteMode && this.props.userId > 0 ? "云端文档" : "本地文档"}</span>
          </div>
          <div className="nice-document-navigator-actions">
            <Button
              type="text"
              size="small"
              icon={<ReloadOutlined />}
              className="nice-document-navigator-action"
              onClick={this.loadDocuments}
              aria-label="刷新文档"
              title="刷新文档"
            />
            <Button
              type="text"
              size="small"
              icon={<PushpinOutlined />}
              className={`nice-document-navigator-action${this.props.pinned ? " nice-document-navigator-pin-active" : ""}`}
              onClick={this.handlePinnedChange}
              aria-label={this.props.pinned ? "取消固定文档导航" : "固定文档导航"}
              title={this.props.pinned ? "取消固定文档导航" : "固定文档导航"}
            />
            <Button
              type="text"
              size="small"
              icon={<CloseOutlined />}
              className="nice-document-navigator-action"
              onClick={this.handleClose}
              aria-label="关闭文档导航"
              title="关闭文档导航"
            />
          </div>
        </header>
        <div className="nice-document-navigator-tree-wrap">
          <div className="nice-document-navigator-section-label">目录</div>
          {this.renderTree()}
        </div>
      </div>
    );
  }

  render() {
    if (this.props.pinned) {
      return <aside className="nice-document-navigator-pinned-panel">{this.renderNavigator()}</aside>;
    }
    return (
      <Drawer
        placement="left"
        width={320}
        visible={this.props.open}
        mask
        closable={false}
        className="nice-document-navigator-drawer"
        bodyStyle={{padding: 0}}
        onClose={this.handleClose}
      >
        {this.renderNavigator()}
      </Drawer>
    );
  }
}

export default DocumentNavigator;
