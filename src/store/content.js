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
    window.localStorage.setItem(CONTENT, content);
  };

  @action
  setDocumentId = (documentId) => {
    this.documentId = documentId;
    window.localStorage.setItem(DOCUMENT_ID, String(documentId));
  };

  @action
  setDocumentName = (documentName) => {
    this.documentName = documentName;
    window.localStorage.setItem(DOCUMENT_NAME, documentName || "");
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
    window.localStorage.setItem(DOCUMENT_UPDATED_AT, String(nextValue));
  };

  @action
  setDocumentCategoryId = (documentCategoryId) => {
    const nextValue = documentCategoryId != null ? Number(documentCategoryId) : DEFAULT_CATEGORY_ID;
    this.documentCategoryId = Number.isNaN(nextValue) ? DEFAULT_CATEGORY_ID : nextValue;
    window.localStorage.setItem(DOCUMENT_CATEGORY_ID, String(this.documentCategoryId));
  };

  @action
  setDocumentCategoryName = (documentCategoryName) => {
    const nextValue = documentCategoryName || DEFAULT_CATEGORY_NAME;
    this.documentCategoryName = nextValue;
    window.localStorage.setItem(DOCUMENT_CATEGORY_NAME, nextValue);
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
      window.localStorage.setItem(STYLE, style);
    }
    this.style = window.localStorage.getItem(STYLE);
    replaceStyle(MARKDOWN_THEME_ID, this.style);
  };
}

const store = new Content();

// 如果为空先把数据放进去
if (window.localStorage.getItem(CONTENT) === null) {
  window.localStorage.setItem(CONTENT, TEMPLATE.content);
}
if (window.localStorage.getItem(DOCUMENT_ID) === null) {
  window.localStorage.setItem(DOCUMENT_ID, "1");
}
if (window.localStorage.getItem(DOCUMENT_NAME) === null) {
  window.localStorage.setItem(DOCUMENT_NAME, "未命名.md");
}
if (window.localStorage.getItem(DOCUMENT_UPDATED_AT) === null) {
  window.localStorage.setItem(DOCUMENT_UPDATED_AT, "0");
}
if (window.localStorage.getItem(DOCUMENT_CATEGORY_ID) === null) {
  window.localStorage.setItem(DOCUMENT_CATEGORY_ID, String(DEFAULT_CATEGORY_ID));
}
if (window.localStorage.getItem(DOCUMENT_CATEGORY_NAME) === null) {
  window.localStorage.setItem(DOCUMENT_CATEGORY_NAME, DEFAULT_CATEGORY_NAME);
}
if (!window.localStorage.getItem(STYLE)) {
  window.localStorage.setItem(STYLE, TEMPLATE.style.custom);
}

const templateNum = parseInt(window.localStorage.getItem(TEMPLATE_NUM), 10);

// 用于处理刷新后的信息持久化
// 属于自定义主题则从localstorage中读数据
if (templateNum === TEMPLATE_CUSTOM_NUM) {
  store.style = window.localStorage.getItem(STYLE);
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

store.content = window.localStorage.getItem(CONTENT);
store.documentId = parseInt(window.localStorage.getItem(DOCUMENT_ID), 10) || 1;
store.documentName = window.localStorage.getItem(DOCUMENT_NAME) || "未命名.md";
store.documentUpdatedAt = parseInt(window.localStorage.getItem(DOCUMENT_UPDATED_AT), 10) || 0;
store.documentCategoryId = parseInt(window.localStorage.getItem(DOCUMENT_CATEGORY_ID), 10) || DEFAULT_CATEGORY_ID;
store.documentCategoryName = window.localStorage.getItem(DOCUMENT_CATEGORY_NAME) || DEFAULT_CATEGORY_NAME;

export default store;
