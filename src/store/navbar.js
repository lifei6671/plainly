import {observable, action} from "mobx";
import {
  TEMPLATE_NUM,
  CODE_NUM,
  CODE_THEME_ID,
  CODE_OPTIONS,
  PREVIEW_TYPE,
  IS_SYNC_SCROLL,
  IS_CONTAIN_IMG_NAME,
  IS_MAC_CODE,
} from "../utils/constant";
import TEMPLATE from "../template/index";
import {replaceStyle} from "../utils/helper";
import {getConfigSync, setConfigSync} from "../utils/configStore";

class Navbar {
  // 是否同步滚动
  @observable isSyncScroll = true;

  // 是否保留图片名称
  @observable isContainImgName = false;

  // 主题序号
  @observable templateNum;

  // 代码主题序号
  @observable codeNum;

  // 是否为 Mac 风格代码
  @observable isMacCode = false;

  // 预览类型
  @observable previewType;

  @action
  setSyncScroll = (isSyncScroll) => {
    this.isSyncScroll = isSyncScroll;
    setConfigSync(IS_SYNC_SCROLL, isSyncScroll);
  };

  @action
  setContainImgName = (isContainImgName) => {
    this.isContainImgName = isContainImgName;
    setConfigSync(IS_CONTAIN_IMG_NAME, isContainImgName);
  };

  @action
  setTemplateNum = (templateNum) => {
    this.templateNum = templateNum;
    setConfigSync(TEMPLATE_NUM, templateNum);
  };

  @action
  setCodeNum = (codeNum, isMacCode) => {
    this.codeNum = codeNum;
    setConfigSync(CODE_NUM, codeNum);
    // 更新style
    const {id, macId} = CODE_OPTIONS[codeNum];
    // 非微信代码块
    if (codeNum !== 0) {
      //  Mac 风格代码
      if (isMacCode) {
        replaceStyle(CODE_THEME_ID, TEMPLATE.code[macId]);
      } else {
        replaceStyle(CODE_THEME_ID, TEMPLATE.code[id]);
      }
    }
  };

  @action
  setMacCode = (isMacCode) => {
    this.isMacCode = isMacCode;
    setConfigSync(IS_MAC_CODE, isMacCode);
  };

  @action
  setPreviewType = (previewType) => {
    this.previewType = previewType;
    setConfigSync(PREVIEW_TYPE, previewType);
  };
}

const store = new Navbar();

// 如果为空先把数据放进去
if (getConfigSync(TEMPLATE_NUM) === null) {
  setConfigSync(TEMPLATE_NUM, 0);
}

// 如果为空先把数据放进去
if (getConfigSync(CODE_NUM) === null) {
  setConfigSync(CODE_NUM, 1);
}

if (!getConfigSync(PREVIEW_TYPE)) {
  setConfigSync(PREVIEW_TYPE, "mobile");
}

if (getConfigSync(IS_SYNC_SCROLL) === null) {
  setConfigSync(IS_SYNC_SCROLL, true);
}

if (getConfigSync(IS_CONTAIN_IMG_NAME) === null) {
  setConfigSync(IS_CONTAIN_IMG_NAME, false);
}

if (getConfigSync(IS_MAC_CODE) === null) {
  setConfigSync(IS_MAC_CODE, true);
}

// 获取之前选择的主题状态
store.templateNum = parseInt(String(getConfigSync(TEMPLATE_NUM, 0)), 10);
store.codeNum = parseInt(String(getConfigSync(CODE_NUM, 1)), 10);
store.previewType = getConfigSync(PREVIEW_TYPE, "mobile");
store.isSyncScroll = Boolean(getConfigSync(IS_SYNC_SCROLL, true));
store.isContainImgName = Boolean(getConfigSync(IS_CONTAIN_IMG_NAME, false));
store.isMacCode = Boolean(getConfigSync(IS_MAC_CODE, true));

// 初始化代码主题
const {macId, id} = CODE_OPTIONS[store.codeNum];
if (store.codeNum !== 0) {
  if (store.isMacCode) {
    replaceStyle(CODE_THEME_ID, TEMPLATE.code[macId]);
  } else {
    replaceStyle(CODE_THEME_ID, TEMPLATE.code[id]);
  }
}

export default store;
