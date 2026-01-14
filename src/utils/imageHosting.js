/**
 * 图片上传
 */
import * as qiniu from "qiniu-js";
import {message} from "antd";
import axios from "axios";
import OSS from "ali-oss";
import imageHosting from "../store/imageHosting";

import {
  SM_MS_PROXY,
  SM_MS_TOKEN,
  ALIOSS_IMAGE_HOSTING,
  QINIUOSS_IMAGE_HOSTING,
  R2_IMAGE_HOSTING,
  IMAGE_HOSTING_TYPE,
  IS_CONTAIN_IMG_NAME,
  IMAGE_HOSTING_NAMES,
} from "./constant";
import {S3Client, PutObjectCommand} from "@aws-sdk/client-s3";
import {toBlob, getOSSName, axiosMdnice} from "./helper";
import {invoke} from "@tauri-apps/api/tauri";
import createQiniuUploadToken from "./qiuniu";
import compressThenWebp from "./imageCompress";
import renderObjectName from "./imageFilename";

function isTauriEnv() {
  if (typeof window === "undefined") {
    return false;
  }
  return (
    // eslint-disable-next-line no-underscore-dangle
    typeof window.__TAURI_IPC__ === "function" || (window.__TAURI__ && typeof window.__TAURI__.invoke === "function")
  );
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || "";
      if (typeof result !== "string") {
        reject(new Error("读取文件失败"));
        return;
      }
      const base64 = result.split(",").pop() || "";
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error || new Error("读取文件失败"));
    reader.readAsDataURL(file);
  });
}

function withTimeout(promise, timeoutMs, errorMessage) {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function toWebpFile(blob, originalName) {
  const safeName = (originalName && String(originalName).trim()) || "image";
  const parts = safeName.split(".");
  if (parts.length > 1) {
    parts.pop();
  }
  const baseName = parts.length ? parts.join(".") : safeName;
  const fileName = `${baseName}.webp`;
  try {
    return new File([blob], fileName, {type: blob.type || "image/webp"});
  } catch (error) {
    const fileLike = blob;
    fileLike.name = fileName;
    return fileLike;
  }
}

const DEFAULT_R2_FILENAME_TEMPLATE = "image_${YYYY}${MM}${DD}_${Timestamp}_${RAND:6}.${EXT}";

function showUploadNoti() {
  message.loading("图片上传中", 0);
}

function uploadError(description = "图片上传失败") {
  message.error(description, 3);
}

function hideUploadNoti() {
  message.destroy();
  message.success("图片上传成功");
}

function writeToEditor({content, image}) {
  const isContainImgName = window.localStorage.getItem(IS_CONTAIN_IMG_NAME) === "true";
  console.log(isContainImgName);
  let text = "";
  if (isContainImgName) {
    text = `\n![${image.filename}](${image.url})\n`;
  } else {
    text = `\n![](${image.url})\n`;
  }
  const {markdownEditor} = content;
  const cursor = markdownEditor.getCursor();
  markdownEditor.replaceSelection(text, cursor);
  content.setContent(markdownEditor.getValue());
}

// 七牛云对象存储上传
export const qiniuOSSUpload = async ({
  file = {},
  onSuccess = () => {},
  onError = () => {},
  onProgress = () => {},
  images = [],
  content = null, // store content
}) => {
  showUploadNoti();
  const config = JSON.parse(window.localStorage.getItem(QINIUOSS_IMAGE_HOSTING));
  try {
    let {domain} = config;
    const {namespace} = config;
    // domain可能配置时末尾没有加‘/’
    if (domain[domain.length - 1] !== "/") {
      domain += "/";
    }
    // const result = await axiosMdnice.get(`/qiniu/${config.bucket}/${config.accessKey}/${config.secretKey}`);
    // const token = result.data;

    // 关键改动：不再请求后端；前端本地生成 token
    // 这里 scope 建议绑定到具体 OSSName（更收敛）。如果你希望“随机 key”，也可以只传 bucket。
    const OSSName = getOSSName(file.name, namespace);

    // 这里在前端计算token，非常不安全！但是为了方便没有后端应用的开发者使用，只能这么干！
    const token = await createQiniuUploadToken({
      accessKey: config.accessKey,
      secretKey: config.secretKey,
      bucket: config.bucket,
      key: OSSName, // 推荐：绑定 key
      expiresSeconds: 10 * 60, // 推荐：短一点，10 分钟
      extraPolicy: {
        // 可选：如果你不希望覆盖同名文件，可以打开 insertOnly
        // insertOnly: 1,
      },
    });

    const base64Reader = new FileReader();

    base64Reader.readAsDataURL(file);

    base64Reader.onload = (e) => {
      const urlData = e.target.result;
      const base64 = urlData.split(",").pop();
      const fileType = urlData
        .split(";")
        .shift()
        .split(":")
        .pop();

      // base64转blob
      const blob = toBlob(base64, fileType);

      const conf = {
        useCdnDomain: true,
        region: qiniu.region[config.region], // 区域
      };

      const putExtra = {
        fname: "",
        params: {},
        mimeType: [] || null,
      };
      // 这里第一个参数的形式是blob
      const imageObservable = qiniu.upload(blob, OSSName, token, putExtra, conf);

      // 上传成功后回调
      const complete = (response) => {
        // console.log(response);
        const names = file.name.split(".");
        names.pop();
        const filename = names.join(".");
        const image = {
          filename, // 名字不变并且去掉后缀
          url: encodeURI(`${domain}${response.key}`),
        };
        images.push(image);

        if (content) {
          writeToEditor({content, image});
        }
        onSuccess(response);
        setTimeout(() => {
          hideUploadNoti();
        }, 500);
      };

      // 上传过程回调
      const next = (response) => {
        // console.log(response);
        const percent = parseInt(Math.round(response.total.percent.toFixed(2)), 10);
        onProgress(
          {
            percent,
          },
          file,
        );
      };

      // 上传错误回调
      const error = (err) => {
        hideUploadNoti();
        uploadError();
        onError(err, err.toString());
      };

      const imageObserver = {
        next,
        error,
        complete,
      };
      // 注册 imageObserver 对象
      imageObservable.subscribe(imageObserver);
    };
  } catch (err) {
    onError(err, err.toString());
  }
};

// 用户自定义的图床上传
export const customImageUpload = async ({
  formData = new FormData(),
  file = {},
  onSuccess = () => {},
  onError = () => {},
  images = [],
  content = null,
}) => {
  showUploadNoti();
  try {
    formData.append("image", file);
    const config = {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    };
    const postURL = imageHosting.hostingUrl;
    const result = await axios.post(postURL, formData, config);
    const names = file.name.split(".");
    names.pop();
    const filename = names.join(".");
    const image = {
      filename,
      url: encodeURI(result.data.link), // 这里要和外接图床规定好数据逻辑，否则会接入失败
    };

    if (content) {
      writeToEditor({content, image});
    }
    images.push(image);
    onSuccess(result);
    setTimeout(() => {
      hideUploadNoti();
    }, 500);
  } catch (error) {
    message.destroy();
    uploadError(error.toString());
    onError(error, error.toString());
  }
};

// SM.MS存储上传
export const smmsUpload = ({
  formData = new FormData(),
  file = {},
  action = SM_MS_PROXY,
  onProgress = () => {},
  onSuccess = () => {},
  onError = () => {},
  headers = {},
  withCredentials = false,
  images = [],
  content = null, // store content
}) => {
  const requestHeaders = {
    ...headers,
  };
  if (!requestHeaders.Authorization) {
    const token = window.localStorage.getItem(SM_MS_TOKEN);
    if (token) {
      requestHeaders.Authorization = token;
    }
  }
  showUploadNoti();
  // SM.MS图床必须这里命名为smfile
  formData.append("smfile", file);
  axios
    .post(action, formData, {
      withCredentials,
      headers: requestHeaders,
      onUploadProgress: ({total, loaded}) => {
        onProgress(
          {
            percent: parseInt(Math.round((loaded / total) * 100).toFixed(2), 10),
          },
          file,
        );
      },
    })
    .then(({data: response}) => {
      const isSuccess =
        response && (response.success === true || response.code === "success" || response.code === "image_repeated");
      if (!isSuccess) {
        const rawMessage = response && (response.message || response.msg || response.code);
        const messageText =
          rawMessage && String(rawMessage).includes("logged in")
            ? "SM.MS 需要登录 Token，请在本地存储中设置 SM_MS_TOKEN"
            : rawMessage || "图片上传失败";
        throw new Error(messageText);
      }
      const responseData = response?.data?.data ?? response?.data ?? null;

      const url = (responseData && responseData.url) || (response && response.images) || (response && response.url);
      if (!url) {
        throw new Error("图片上传失败");
      }
      const names = file.name ? file.name.split(".") : [];
      if (names.length > 1) {
        names.pop();
      }
      const filename =
        (responseData && (responseData.filename || responseData.storename)) ||
        (names.length ? names.join(".") : "image");
      const image = {
        filename,
        url,
      };
      if (content) {
        writeToEditor({content, image});
      }
      images.push(image);
      onSuccess(response, file);
      setTimeout(() => {
        hideUploadNoti();
      }, 500);
    })
    .catch((error) => {
      message.destroy();
      uploadError(error.toString());
      onError(error, error.toString());
    });
};

// 阿里对象存储，上传部分
const aliOSSPutObject = ({config, file, buffer, onSuccess, onError, images, content}) => {
  let client;
  try {
    client = new OSS(config);
  } catch (error) {
    message.error("OSS配置错误，请根据文档检查配置项");
    return;
  }

  const OSSName = getOSSName(file.name);

  client
    .put(OSSName, buffer)
    .then((response) => {
      const names = file.name.split(".");
      names.pop();
      const filename = names.join(".");
      const image = {
        filename, // 名字不变并且去掉后缀
        url: response.url,
      };
      if (content) {
        writeToEditor({content, image});
      }
      images.push(image);
      onSuccess(response, file);
      setTimeout(() => {
        hideUploadNoti();
      }, 500);
    })
    .catch((error) => {
      console.log(error);

      hideUploadNoti();
      uploadError("请根据文档检查配置项");
      onError(error, error.toString());
    });
};

// 阿里云对象存储上传，处理部分
export const aliOSSUpload = async ({
  file = {},
  onSuccess = () => {},
  onError = () => {},
  images = [],
  content = null, // store content
}) => {
  showUploadNoti();
  const config = JSON.parse(window.localStorage.getItem(ALIOSS_IMAGE_HOSTING));
  if (isTauriEnv()) {
    try {
      const uploadFile = file && file.originFileObj ? file.originFileObj : file;
      if (!uploadFile || typeof uploadFile.arrayBuffer !== "function") {
        throw new Error("未获取到有效的上传文件");
      }

      const key = getOSSName(uploadFile.name || file.name || "image");
      const contentType = uploadFile.type || file.type || "application/octet-stream";
      const filePath = uploadFile.path || file.path || "";
      let bodyBase64 = null;
      if (!filePath) {
        bodyBase64 = await fileToBase64(uploadFile);
        if (!bodyBase64) {
          throw new Error("读取文件失败");
        }
      }

      await withTimeout(
        invoke("alioss_upload", {
          payload: {
            region: config.region,
            accessKeyId: config.accessKeyId,
            accessKeySecret: config.accessKeySecret,
            bucket: config.bucket,
            key,
            contentType,
            filePath,
            bodyBase64,
          },
        }),
        30000,
        "上传超时，请检查网络或图床配置",
      );

      const names = uploadFile.name ? uploadFile.name.split(".") : [];
      if (names.length > 1) {
        names.pop();
      }
      const filename = names.length ? names.join(".") : "image";
      const baseUrl = `https://${config.bucket}.${config.region}.aliyuncs.com/`;
      const image = {
        filename,
        url: encodeURI(`${baseUrl}${key}`),
      };

      if (content) {
        writeToEditor({content, image});
      }
      images.push(image);
      onSuccess({key}, file);
      setTimeout(() => {
        hideUploadNoti();
      }, 500);
    } catch (error) {
      message.destroy();
      uploadError(error.toString());
      onError(error, error.toString());
    }
    return;
  }
  const base64Reader = new FileReader();
  base64Reader.readAsDataURL(file);
  base64Reader.onload = (e) => {
    const urlData = e.target.result;
    const base64 = urlData.split(",").pop();
    const fileType = urlData
      .split(";")
      .shift()
      .split(":")
      .pop();

    // base64转blob
    const blob = toBlob(base64, fileType);

    // blob转arrayBuffer
    const bufferReader = new FileReader();
    bufferReader.readAsArrayBuffer(blob);
    bufferReader.onload = (event) => {
      const buffer = new OSS.Buffer(event.target.result);
      aliOSSPutObject({config, file, buffer, onSuccess, onError, images, content});
    };
  };
};

// Cloudflare R2 上传
export const r2Upload = async ({
  file = {},
  onSuccess = () => {},
  onError = () => {},
  images = [],
  content = null, // store content
}) => {
  showUploadNoti();
  try {
    const config = JSON.parse(window.localStorage.getItem(R2_IMAGE_HOSTING));
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
      throw new Error("请先配置 Cloudflare R2 图床");
    }

    const uploadFile = file && file.originFileObj ? file.originFileObj : file;
    if (!uploadFile || typeof uploadFile.arrayBuffer !== "function") {
      throw new Error("未获取到有效的上传文件");
    }

    const size = Number(config.size ?? 0);
    const quality = clampNumber(config.quality ?? 88, 50, 100, 88);
    let workingFile = uploadFile;
    if (uploadFile.type && uploadFile.type.startsWith("image/")) {
      try {
        const maxDimension = size > 0 ? size : Number.MAX_SAFE_INTEGER;
        const webpBlob = await compressThenWebp(uploadFile, {
          quality: quality / 100,
          maxWidth: maxDimension,
          maxHeight: maxDimension,
        });
        workingFile = toWebpFile(webpBlob, uploadFile.name || file.name || "image");
      } catch (error) {
        workingFile = uploadFile;
      }
    }

    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;
    const hasFilenameTemplate = Object.prototype.hasOwnProperty.call(config, "filenameTemplate");
    const rawFilenameTemplate = hasFilenameTemplate
      ? String(config.filenameTemplate ?? "")
      : DEFAULT_R2_FILENAME_TEMPLATE;
    const filenameTemplate = rawFilenameTemplate.trim();
    let objectName = workingFile.name || uploadFile.name || file.name || "image";
    if (filenameTemplate) {
      let normalizedTemplate = filenameTemplate;
      if (!normalizedTemplate.includes("${EXT}")) {
        normalizedTemplate += ".${EXT}";
      }
      objectName = renderObjectName(normalizedTemplate, {file: workingFile});
    }
    const namespace = config.namespace || "";
    const key = `${namespace}${objectName}`;
    const contentType = workingFile.type || uploadFile.type || file.type || "application/octet-stream";
    if (isTauriEnv()) {
      const canUseFilePath = workingFile === uploadFile;
      const filePath = canUseFilePath ? workingFile.path || uploadFile.path || file.path || "" : "";
      let bodyBase64 = null;
      if (!filePath) {
        bodyBase64 = await fileToBase64(workingFile);
        if (!bodyBase64) {
          throw new Error("读取文件失败");
        }
      }
      await withTimeout(
        invoke("r2_upload", {
          payload: {
            accountId: config.accountId,
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
            bucket: config.bucket,
            key,
            contentType,
            filePath,
            bodyBase64,
          },
        }),
        30000,
        "上传超时，请检查网络或图床配置",
      );
    } else {
      const fileBuffer = await workingFile.arrayBuffer();
      const client = new S3Client({
        region: "auto",
        endpoint,
        forcePathStyle: true,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      const body = new Uint8Array(fileBuffer);
      await client.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
        }),
      );
    }

    let baseUrl = config.publicBaseUrl || "";
    if (baseUrl && baseUrl[baseUrl.length - 1] !== "/") {
      baseUrl += "/";
    }
    if (!baseUrl) {
      baseUrl = `${endpoint}/${config.bucket}/`;
    }

    const names = objectName ? objectName.split(".") : [];
    if (names.length > 1) {
      names.pop();
    }
    const filename = names.length ? names.join(".") : "image";
    const image = {
      filename,
      url: encodeURI(`${baseUrl}${key}`),
    };

    if (content) {
      writeToEditor({content, image});
    }
    images.push(image);
    onSuccess({key}, file);
    setTimeout(() => {
      hideUploadNoti();
    }, 500);
  } catch (error) {
    message.destroy();
    uploadError(error.toString());
    onError(error, error.toString());
  }
};

// 自动检测上传配置，进行上传
export const uploadAdaptor = (...args) => {
  const type = localStorage.getItem(IMAGE_HOSTING_TYPE); // SM.MS | 阿里云 | 七牛云 | 用户自定义图床
  const userType = imageHosting.hostingName;
  if (type === userType) {
    return customImageUpload(...args);
  } else if (type === IMAGE_HOSTING_NAMES.smms) {
    return smmsUpload(...args);
  } else if (type === IMAGE_HOSTING_NAMES.r2) {
    const config = JSON.parse(window.localStorage.getItem(R2_IMAGE_HOSTING));
    if (!config.accountId || !config.accessKeyId || !config.secretAccessKey || !config.bucket) {
      message.error("请先配置 Cloudflare R2 图床");
      return false;
    }
    return r2Upload(...args);
  } else if (type === IMAGE_HOSTING_NAMES.qiniuyun) {
    const config = JSON.parse(window.localStorage.getItem(QINIUOSS_IMAGE_HOSTING));
    if (
      !config.region.length ||
      !config.accessKey.length ||
      !config.secretKey.length ||
      !config.bucket.length ||
      !config.domain.length
    ) {
      message.error("请先配置七牛云图床");
      return false;
    }
    return qiniuOSSUpload(...args);
  } else if (type === IMAGE_HOSTING_NAMES.aliyun) {
    const config = JSON.parse(window.localStorage.getItem(ALIOSS_IMAGE_HOSTING));
    if (
      !config.region.length ||
      !config.accessKeyId.length ||
      !config.accessKeySecret.length ||
      !config.bucket.length
    ) {
      message.error("请先配置阿里云图床");
      return false;
    }
    return aliOSSUpload(...args);
  }
  return true;
};
