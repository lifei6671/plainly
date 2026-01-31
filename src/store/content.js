import {observable, action} from "mobx";
import {
  CONTENT,
  DOCUMENT_ID,
  DOCUMENT_NAME,
  DOCUMENT_UPDATED_AT,
  DOCUMENT_CATEGORY_ID,
  DOCUMENT_CATEGORY_NAME,
  STYLE,
  TEMPLATE_OPTIONS,
  TEMPLATE_NUM,
  TEMPLATE_CUSTOM_NUM,
  MARKDOWN_THEME_ID,
  BASIC_THEME_ID,
  STYLE_LABELS,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORY_NAME,
} from "../utils/constant";
import {replaceStyle, addStyleLabel} from "../utils/helper";
import TEMPLATE from "../template/index";
import {getConfigSync, setConfigSync} from "../utils/configStore";

class Content {
  @observable content;

  @observable style;

  @observable markdownEditor;

  @observable documentId;

  @observable documentName;

  @observable documentUpdatedAt;

  @observable documentCategoryId;

  @observable documentCategoryName;

  @action
  setMarkdownEditor = (markdownEditor) => {
    this.markdownEditor = markdownEditor;
  };

  @action
  setContent = (content) => {
    this.content = content;
    setConfigSync(CONTENT, content);
  };

  @action
  setDocumentId = (documentId) => {
    this.documentId = documentId;
    setConfigSync(DOCUMENT_ID, String(documentId));
  };

  @action
  setDocumentName = (documentName) => {
    this.documentName = documentName;
    setConfigSync(DOCUMENT_NAME, documentName || "");
  };

  @action
  setDocumentUpdatedAt = (documentUpdatedAt) => {
    let nextValue = 0;
    if (documentUpdatedAt instanceof Date) {
      nextValue = documentUpdatedAt.getTime();
    } else if (documentUpdatedAt != null) {
      const parsed = Number(documentUpdatedAt);
      nextValue = Number.isNaN(parsed) ? 0 : parsed;
    }
    this.documentUpdatedAt = nextValue;
    setConfigSync(DOCUMENT_UPDATED_AT, String(nextValue));
  };

  @action
  setDocumentCategoryId = (documentCategoryId) => {
    const nextValue = documentCategoryId != null ? Number(documentCategoryId) : DEFAULT_CATEGORY_ID;
    this.documentCategoryId = Number.isNaN(nextValue) ? DEFAULT_CATEGORY_ID : nextValue;
    setConfigSync(DOCUMENT_CATEGORY_ID, String(this.documentCategoryId));
  };

  @action
  setDocumentCategoryName = (documentCategoryName) => {
    const nextValue = documentCategoryName || DEFAULT_CATEGORY_NAME;
    this.documentCategoryName = nextValue;
    setConfigSync(DOCUMENT_CATEGORY_NAME, nextValue);
  };

  @action
  setDocumentCategory = (documentCategoryId, documentCategoryName) => {
    this.setDocumentCategoryId(documentCategoryId);
    if (documentCategoryName) {
      this.setDocumentCategoryName(documentCategoryName);
    } else if (!this.documentCategoryName) {
      this.setDocumentCategoryName(DEFAULT_CATEGORY_NAME);
    }
  };

  @action
  setStyle = (style) => {
    this.style = style;
    replaceStyle(MARKDOWN_THEME_ID, style);
  };

  // 自定义样式
  @action
  setCustomStyle = (style = "") => {
    // 如果传入则更新
    if (style) {
      setConfigSync(STYLE, style);
    }
    this.style = getConfigSync(STYLE, TEMPLATE.style.custom);
    replaceStyle(MARKDOWN_THEME_ID, this.style);
  };
}

const store = new Content();

// 如果为空先把数据放进去
if (getConfigSync(CONTENT) === null) {
  setConfigSync(CONTENT, TEMPLATE.content);
}
if (getConfigSync(DOCUMENT_ID) === null) {
  setConfigSync(DOCUMENT_ID, "1");
}
if (getConfigSync(DOCUMENT_NAME) === null) {
  setConfigSync(DOCUMENT_NAME, "未命名.md");
}
if (getConfigSync(DOCUMENT_UPDATED_AT) === null) {
  setConfigSync(DOCUMENT_UPDATED_AT, "0");
}
if (getConfigSync(DOCUMENT_CATEGORY_ID) === null) {
  setConfigSync(DOCUMENT_CATEGORY_ID, String(DEFAULT_CATEGORY_ID));
}
if (getConfigSync(DOCUMENT_CATEGORY_NAME) === null) {
  setConfigSync(DOCUMENT_CATEGORY_NAME, DEFAULT_CATEGORY_NAME);
}
if (!getConfigSync(STYLE)) {
  setConfigSync(STYLE, TEMPLATE.style.custom);
}

const templateNum = parseInt(String(getConfigSync(TEMPLATE_NUM, 0)), 10);

// 用于处理刷新后的信息持久化
// 属于自定义主题则从localstorage中读数据
if (templateNum === TEMPLATE_CUSTOM_NUM) {
  store.style = getConfigSync(STYLE, TEMPLATE.style.custom);
} else {
  if (templateNum) {
    const {id} = TEMPLATE_OPTIONS[templateNum];
    store.style = TEMPLATE.style[id];
  } else {
    store.style = TEMPLATE.style.normal;
  }
}

// 在head中添加style标签
addStyleLabel(STYLE_LABELS);

// 初始化整体主题
replaceStyle(BASIC_THEME_ID, TEMPLATE.basic);
replaceStyle(MARKDOWN_THEME_ID, store.style);

store.content = getConfigSync(CONTENT, TEMPLATE.content);
store.documentId = parseInt(String(getConfigSync(DOCUMENT_ID, 1)), 10) || 1;
store.documentName = getConfigSync(DOCUMENT_NAME, "未命名.md");
store.documentUpdatedAt = parseInt(String(getConfigSync(DOCUMENT_UPDATED_AT, 0)), 10) || 0;
store.documentCategoryId =
  parseInt(String(getConfigSync(DOCUMENT_CATEGORY_ID, DEFAULT_CATEGORY_ID)), 10) || DEFAULT_CATEGORY_ID;
store.documentCategoryName = getConfigSync(DOCUMENT_CATEGORY_NAME, DEFAULT_CATEGORY_NAME);

export default store;
