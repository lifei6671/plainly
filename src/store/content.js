import {observable, action} from "mobx";
import {
  CONTENT,
  DOCUMENT_ID,
  DOCUMENT_UUID,
  DOCUMENT_NAME,
  DOCUMENT_UPDATED_AT,
  DOCUMENT_CATEGORY_ID,
  DOCUMENT_CATEGORY_UUID,
  DOCUMENT_CATEGORY_NAME,
  STYLE,
  TEMPLATE_OPTIONS,
  TEMPLATE_NUM,
  TEMPLATE_CUSTOM_NUM,
  MARKDOWN_THEME_ID,
  BASIC_THEME_ID,
  STYLE_LABELS,
  DEFAULT_CATEGORY_ID,
  DEFAULT_CATEGORY_UUID,
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

  @observable documentUuid;

  @observable documentName;

  @observable documentUpdatedAt;

  @observable documentCategoryId;

  @observable documentCategoryUuid;

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
    const nextValue = documentId ? String(documentId).replace(/-/g, "") : "";
    this.documentId = nextValue;
    setConfigSync(DOCUMENT_ID, nextValue);
  };

  @action
  setDocumentUuid = (documentUuid) => {
    const nextValue = documentUuid ? String(documentUuid).replace(/-/g, "") : "";
    this.documentUuid = nextValue;
    this.documentId = nextValue;
    setConfigSync(DOCUMENT_ID, nextValue);
    setConfigSync(DOCUMENT_UUID, nextValue);
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
    const parsed = Number(documentCategoryId);
    this.documentCategoryId = Number.isFinite(parsed) ? parsed : DEFAULT_CATEGORY_ID;
  };

  @action
  setDocumentCategoryUuid = (documentCategoryUuid) => {
    const nextValue = documentCategoryUuid
      ? String(documentCategoryUuid).replace(/-/g, "")
      : DEFAULT_CATEGORY_UUID;
    this.documentCategoryUuid = nextValue;
    setConfigSync(DOCUMENT_CATEGORY_ID, String(nextValue));
    setConfigSync(DOCUMENT_CATEGORY_UUID, String(nextValue));
  };

  @action
  setDocumentCategoryName = (documentCategoryName) => {
    const nextValue = documentCategoryName || DEFAULT_CATEGORY_NAME;
    this.documentCategoryName = nextValue;
    setConfigSync(DOCUMENT_CATEGORY_NAME, nextValue);
  };

  @action
  setDocumentCategory = (documentCategoryUuid, documentCategoryName, documentCategoryId) => {
    const uuidValue = documentCategoryUuid ?? DEFAULT_CATEGORY_UUID;
    const legacyId =
      documentCategoryId != null
        ? documentCategoryId
        : typeof documentCategoryUuid === "number"
          ? documentCategoryUuid
          : typeof documentCategoryUuid === "string" && /^\d+$/.test(documentCategoryUuid)
            ? Number(documentCategoryUuid)
            : null;
    if (legacyId != null) {
      this.setDocumentCategoryId(legacyId);
    }
    this.setDocumentCategoryUuid(uuidValue);
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
  const legacy = getConfigSync(DOCUMENT_UUID, "");
  setConfigSync(DOCUMENT_ID, legacy ? String(legacy).replace(/-/g, "") : "");
}
if (getConfigSync(DOCUMENT_NAME) === null) {
  setConfigSync(DOCUMENT_NAME, "未命名.md");
}
if (getConfigSync(DOCUMENT_UPDATED_AT) === null) {
  setConfigSync(DOCUMENT_UPDATED_AT, "0");
}
if (getConfigSync(DOCUMENT_CATEGORY_ID) === null) {
  const legacy = getConfigSync(DOCUMENT_CATEGORY_UUID, DEFAULT_CATEGORY_UUID);
  setConfigSync(
    DOCUMENT_CATEGORY_ID,
    legacy ? String(legacy).replace(/-/g, "") : DEFAULT_CATEGORY_UUID,
  );
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
const storedDocumentId =
  String(getConfigSync(DOCUMENT_ID, "")) || String(getConfigSync(DOCUMENT_UUID, "") || "");
store.documentId = storedDocumentId.replace(/-/g, "");
store.documentUuid = store.documentId;
store.documentName = getConfigSync(DOCUMENT_NAME, "未命名.md");
store.documentUpdatedAt = parseInt(String(getConfigSync(DOCUMENT_UPDATED_AT, 0)), 10) || 0;
const storedCategoryId = String(getConfigSync(DOCUMENT_CATEGORY_ID, DEFAULT_CATEGORY_UUID) || "");
store.documentCategoryId = Number.isFinite(Number(storedCategoryId))
  ? Number(storedCategoryId)
  : DEFAULT_CATEGORY_ID;
store.documentCategoryUuid = (storedCategoryId || DEFAULT_CATEGORY_UUID).replace(/-/g, "");
store.documentCategoryName = getConfigSync(DOCUMENT_CATEGORY_NAME, DEFAULT_CATEGORY_NAME);

export default store;
