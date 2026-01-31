import {observable, action} from "mobx";
import {IMAGE_HOSTING_TYPE, ALIOSS_IMAGE_HOSTING, QINIUOSS_IMAGE_HOSTING, R2_IMAGE_HOSTING} from "../utils/constant";
import {getConfigSync, setConfigSync} from "../utils/configStore";

class ImageHosting {
  @observable type = "";

  @observable hostingList = [];

  @observable hostingUrl = "";

  @observable hostingName = "";

  @action
  setType = (type) => {
    this.type = type;
  };

  @action
  setHostingUrl = (url) => {
    this.hostingUrl = url;
  };

  @action
  setHostingName = (name) => {
    this.hostingName = name;
  };

  @action
  addImageHosting = (name) => {
    this.hostingList.push({
      value: name,
      label: name,
    });
  };
}

const store = new ImageHosting();

// 如果为空先把数据放进去
if (!getConfigSync(ALIOSS_IMAGE_HOSTING)) {
  setConfigSync(ALIOSS_IMAGE_HOSTING, {
    region: "",
    accessKeyId: "",
    accessKeySecret: "",
    bucket: "",
  });
}

// 如果为空先把数据放进去
if (!getConfigSync(QINIUOSS_IMAGE_HOSTING)) {
  setConfigSync(QINIUOSS_IMAGE_HOSTING, {
    region: "",
    accessKey: "",
    secretKey: "",
    bucket: "",
    domain: "https://",
    namespace: "",
  });
}

// 如果为空先把数据放进去
if (!getConfigSync(R2_IMAGE_HOSTING)) {
  setConfigSync(R2_IMAGE_HOSTING, {
    accountId: "",
    accessKeyId: "",
    secretAccessKey: "",
    bucket: "",
    publicBaseUrl: "",
    namespace: "",
    size: 0,
    quality: 88,
    filenameTemplate: "image_${YYYY}${MM}${DD}_${Timestamp}_${RAND:6}.${EXT}",
  });
}

store.type = getConfigSync(IMAGE_HOSTING_TYPE, "");

export default store;
