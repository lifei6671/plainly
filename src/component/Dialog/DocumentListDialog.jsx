import React, {Component} from "react";
import {observer, inject} from "mobx-react";
import {Modal, Table, Button, Empty, message, Select, Input} from "antd";
import {SearchOutlined} from "@ant-design/icons";
import {ensureIndexReady, markIndexDirty, scheduleIndexRebuild, search as searchIndex} from "../../search";
import {getDataStore} from "../../data/store";
import {DEFAULT_CATEGORY_ID, DEFAULT_CATEGORY_NAME} from "../../utils/constant";

const ALL_CATEGORY_ID = "all";

@inject("dialog")
@inject("content")
@observer
class DocumentListDialog extends Component {
  pageSize = 5;

  tableWrapRef = React.createRef();

  wasOpen = false;

  isFetching = false;

  constructor(props) {
    super(props);
    this.state = {
      articles: [],
      loading: false,
      loadingMore: false,
      hasMore: false,
      categories: [],
      selectedCategoryId: ALL_CATEGORY_ID,
      searchText: "",
      searchQuery: "",
    };
  }

  componentDidMount() {
    this.wasOpen = this.props.dialog.isDocumentListOpen;
    if (this.wasOpen) {
      this.loadCategories();
      this.loadArticles();
    }
  }

  getDataStore() {
    const uid =
      (typeof window !== "undefined" && (window.__DATA_STORE_USER_ID__ || window.__CURRENT_USER_ID__)) || 0;
    return getDataStore("remote", Number(uid) || 0);
  }

  componentDidUpdate() {
    const isOpen = this.props.dialog.isDocumentListOpen;
    if (isOpen && !this.wasOpen) {
      this.setState({selectedCategoryId: ALL_CATEGORY_ID, searchText: "", searchQuery: ""}, () => {
        this.loadCategories();
        this.loadArticles();
      });
    }
    this.wasOpen = isOpen;
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

  buildCategoryLookup = (categories) => {
    const byId = new Map();
    const byName = new Map();
    categories.forEach((category) => {
      byId.set(category.id, category);
      if (category.name) {
        byName.set(category.name, category.id);
      }
    });
    return {byId, byName};
  };

  normalizeCategoryId = (value, categories) => {
    const {byId, byName} = this.buildCategoryLookup(categories);
    if (typeof value === "number") {
      return byId.has(value) ? value : DEFAULT_CATEGORY_ID;
    }
    if (typeof value === "string" && value.trim()) {
      const trimmed = value.trim();
      if (byName.has(trimmed)) {
        return byName.get(trimmed);
      }
      const parsed = Number(trimmed);
      if (!Number.isNaN(parsed) && byId.has(parsed)) {
        return parsed;
      }
    }
    return DEFAULT_CATEGORY_ID;
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

  loadArticles = () => {
    this.fetchArticles(true);
  };

  loadMoreArticles = () => {
    this.fetchArticles(false);
  };

  fetchArticles = async (reset) => {
    if (this.isFetching || this.state.loading || this.state.loadingMore) {
      return;
    }
    if (!reset && !this.state.hasMore) {
      return;
    }
    this.isFetching = true;
    try {
      const offset = reset ? 0 : this.state.articles.length;
      if (reset) {
        if (this.tableWrapRef.current) {
          this.tableWrapRef.current.scrollTop = 0;
        }
        this.setState({articles: [], loading: true, loadingMore: false, hasMore: false});
      } else {
        this.setState({loadingMore: true});
      }
      const useFilters =
        this.state.selectedCategoryId !== ALL_CATEGORY_ID || String(this.state.searchQuery || "").trim() !== "";
      let items = [];
      let hasMore = false;
      if (useFilters) {
        const filtered = await this.loadFilteredArticles();
        items = filtered.slice(offset, offset + this.pageSize);
        hasMore = filtered.length > offset + this.pageSize;
      } else {
        const pageResult = await this.getDataStore().listDocumentsPage(offset, this.pageSize);
        items = pageResult.items;
        hasMore = pageResult.hasMore;
      }
      if (items.some((item) => item && item.charCount == null)) {
        const store = this.getDataStore();
        items = await Promise.all(items.map((item) => store.ensureDocumentCharCount(item)));
      }
      this.setState((prevState) => ({
        articles: reset ? items : prevState.articles.concat(items),
        hasMore,
      }));
    } catch (e) {
      console.error(e);
      message.error("获取文档列表失败");
    } finally {
      this.isFetching = false;
      this.setState({loading: false, loadingMore: false});
    }
  };

  loadFilteredArticles = async () => {
    const categories = await this.loadCategories();
    const items = await this.getDataStore().listAllDocuments();
    const normalizedItems = items.map((item) => ({
      ...item,
      category: this.normalizeCategoryId(item.category, categories),
    }));
    let filtered = normalizedItems;
    if (this.state.selectedCategoryId !== ALL_CATEGORY_ID) {
      filtered = filtered.filter((item) => item.category === this.state.selectedCategoryId);
    }
    const query = String(this.state.searchQuery || "").trim();
    if (!query) {
      return filtered;
    }
    const itemsById = new Map();
    filtered.forEach((item) => {
      itemsById.set(String(item.document_id), item);
    });
    let idx = null;
    try {
      idx = await ensureIndexReady();
    } catch (e) {
      console.error(e);
      return [];
    }
    if (!idx) return [];
    const results = searchIndex(idx, query);
    console.log("idx terms count:", Object.keys(idx.invertedIndex).length);
    console.log("Search results:", results);
    return results.map((result) => itemsById.get(result.ref)).filter(Boolean);
  };

  handleLoadMore = () => {
    this.loadMoreArticles();
  };

  handleCategoryChange = (value) => {
    const nextState = {selectedCategoryId: value};
    if (!String(this.state.searchText || "").trim()) {
      nextState.searchQuery = "";
    }
    this.setState(nextState, () => this.fetchArticles(true));
  };

  handleSearchInput = (event) => {
    this.setState({searchText: event.target.value});
  };

  handleSearch = () => {
    this.setState(
      (prevState) => ({
        searchQuery: String(prevState.searchText || "").trim(),
      }),
      () => this.fetchArticles(true),
    );
  };

  loadIntoEditor = async (article) => {
    if (!article || article.document_id == null) {
      return;
    }
    try {
      const content = await this.getDataStore().getDocumentContent(article.document_id);
      const categoryInfo = await this.resolveCategoryInfo(article.category);
      this.props.content.setDocumentId(article.document_id);
      this.props.content.setDocumentName(article.name || "未命名.md");
      this.props.content.setDocumentCategory(categoryInfo.id, categoryInfo.name);
      this.props.content.setDocumentUpdatedAt(article.updatedAt || article.createdAt || 0);
      this.props.content.setContent(content);
      const {markdownEditor} = this.props.content;
      if (markdownEditor) {
        markdownEditor.setValue(content);
        markdownEditor.focus();
      }
      this.props.dialog.setDocumentListOpen(false);
    } catch (e) {
      console.error(e);
      message.error("加载文档失败");
    }
  };

  resolveCategoryInfo = async (value) => {
    const categories = await this.loadCategories();
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

  deleteArticle = async (article) => {
    if (!article || article.document_id == null) {
      return;
    }
    if (article.document_id === this.props.content.documentId) {
      message.warning("当前正在编辑该文档，不能删除。");
      return;
    }
    Modal.confirm({
      title: "确认删除该文档？",
      okText: "删除",
      cancelText: "取消",
      okType: "danger",
      onOk: () =>
        new Promise((resolve, reject) => {
          this.getDataStore()
            .deleteDocument(article.document_id)
            .then(() => {
              this.setState((prevState) => ({
                articles: prevState.articles.filter((item) => item.document_id !== article.document_id),
              }));
              message.success("删除成功");
              markIndexDirty()
                .then(scheduleIndexRebuild)
                .catch(console.error);
              resolve();
            })
            .catch((event) => {
              message.error("删除失败");
              reject(event);
            });
        }),
    });
  };

  render() {
    const columns = [
      {
        title: "文档名称",
        dataIndex: "name",
        key: "name",
        render: (text) => text || "未命名.md",
      },
      {
        title: "字符数",
        dataIndex: "charCount",
        key: "charCount",
        width: 120,
        render: (value) => (value != null ? value : "-"),
      },
      {
        title: "创建时间",
        dataIndex: "createdAt",
        key: "createdAt",
        width: 200,
        render: (value) => this.formatTime(value),
      },
      {
        title: "最后修改时间",
        dataIndex: "updatedAt",
        key: "updatedAt",
        width: 200,
        render: (value, record) => this.formatTime(value || record.createdAt),
      },
      {
        title: "操作",
        key: "action",
        width: 220,
        render: (_, record) => (
          <>
            <Button type="link" onClick={() => this.loadIntoEditor(record)}>
              编辑
            </Button>
            {/* antd v3 Button doesn't support `danger`; use inline color to avoid DOM warnings. */}
            <Button type="link" style={{color: "#ff4d4f"}} onClick={() => this.deleteArticle(record)}>
              删除
            </Button>
          </>
        ),
      },
    ];
    let loadMoreText = "没有更多";
    if (this.state.loadingMore) {
      loadMoreText = "加载中...";
    } else if (this.state.hasMore) {
      loadMoreText = "加载更多";
    }
    const categoryOptions = [{id: ALL_CATEGORY_ID, name: "全部"}, ...this.state.categories];

    return (
      <Modal
        title="文档列表"
        visible={this.props.dialog.isDocumentListOpen}
        onCancel={() => this.props.dialog.setDocumentListOpen(false)}
        footer={null}
        width={1080}
      >
        <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12}}>
          <Select style={{width: 200}} value={this.state.selectedCategoryId} onChange={this.handleCategoryChange}>
            {categoryOptions.map((category) => (
              <Select.Option key={category.id} value={category.id}>
                {category.name || DEFAULT_CATEGORY_NAME}
              </Select.Option>
            ))}
          </Select>
          <div style={{display: "flex", alignItems: "center", gap: 8}}>
            <Input
              placeholder="请输入标题"
              value={this.state.searchText}
              onChange={this.handleSearchInput}
              onPressEnter={this.handleSearch}
              style={{width: 240}}
            />
            <Button icon={<SearchOutlined />} onClick={this.handleSearch}>
              搜索
            </Button>
          </div>
        </div>
        <div ref={this.tableWrapRef} style={{maxHeight: "60vh", overflowY: "auto"}}>
          <Table
            rowKey="document_id"
            columns={columns}
            dataSource={this.state.articles}
            loading={this.state.loading}
            pagination={false}
            locale={{emptyText: <Empty description="暂无文档" />}}
          />
        </div>
        {this.state.articles.length > 0 && (
          <div style={{textAlign: "center", padding: "8px 0 0"}}>
            <Button type="link" onClick={this.handleLoadMore} disabled={!this.state.hasMore || this.state.loadingMore}>
              {loadMoreText}
            </Button>
          </div>
        )}
      </Modal>
    );
  }
}

export default DocumentListDialog;
