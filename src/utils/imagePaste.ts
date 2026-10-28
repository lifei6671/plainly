import {message} from "antd";
import {uploadAdaptor} from "./imageHosting";

type ImagePasteEvent = {
  clipboardData?: {
    files?: ArrayLike<File>;
    getData?: (format: string) => string;
  } | null;
  preventDefault: () => void;
};

export const pasteImages = async (content: any, e: ImagePasteEvent) => {
  const clipboard = e.clipboardData;
  if (!clipboard) {
    return;
  }
  const files = Array.from(clipboard.files || []) as File[];
  const html = clipboard.getData?.("text/html") || "";
  // 网页复制的图片可能只提供 PNG 静态副本；从 HTML 中读取原图以保留动画。
  if (html && files.length <= 1) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const images = doc.querySelectorAll("img");
    const source = images.length === 1 ? images[0].getAttribute("src") || "" : "";
    if (!doc.body.textContent.trim() && /^https?:\/\//i.test(source)) {
      e.preventDefault();
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      let originalFile: File;
      let clipboardFile: File | undefined;
      const readImageFile = async (blob: Blob, name: string) => {
        const header = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String.fromCharCode(...new Uint8Array(reader.result as ArrayBuffer)));
          reader.onerror = () => reject(reader.error || new Error("读取图片失败"));
          reader.readAsArrayBuffer(blob.slice(0, 12));
        });
        // 图片头优先于 MIME；URL 和文件名不用于识别格式。
        let type = blob.type.startsWith("image/") ? blob.type : "";
        if (header.startsWith("\x89PNG\r\n\x1a\n")) type = "image/png";
        else if (header.startsWith("\xff\xd8\xff")) type = "image/jpeg";
        else if (header.startsWith("GIF87a") || header.startsWith("GIF89a")) type = "image/gif";
        else if (header.startsWith("RIFF") && header.slice(8, 12) === "WEBP") type = "image/webp";
        else if (header.startsWith("BM")) type = "image/bmp";
        if (!type) throw new Error("未识别到图片格式");
        if (blob instanceof File && blob.type === type) return blob;
        const extension = type.split("/")[1].replace("jpeg", "jpg");
        return new File([blob], `${name.replace(/\.[^.]+$/, "")}.${extension}`, {type});
      };
      try {
        if (files.length === 1) {
          try {
            clipboardFile = await readImageFile(files[0], files[0].name || "image");
          } catch (_error) {
            // 剪贴板数据不可读时，仍尝试获取网页原图。
          }
          if (clipboardFile && clipboardFile.type !== "image/png") {
            uploadAdaptor({file: clipboardFile, content: content});
            return;
          }
        }
        const url = new URL(source);
        // GitHub raw 中转不允许跨域读取，直接请求其公开原图地址。
        if (url.hostname === "github.com" && /^\/[^/]+\/[^/]+\/raw\//.test(url.pathname)) {
          url.hostname = "raw.githubusercontent.com";
          url.pathname = url.pathname.replace(/^(\/[^/]+\/[^/]+)\/raw\//, "$1/");
        }
        const readImage = async (imageUrl: URL) => {
          const response = await fetch(imageUrl.href, {credentials: "omit", signal: controller.signal});
          if (!response.ok) {
            throw new Error("读取原图失败");
          }
          return readImageFile(await response.blob(), imageUrl.pathname.split("/").pop() || "image");
        };
        try {
          originalFile = await readImage(url);
        } catch (error) {
          if (url.hostname !== "raw.githubusercontent.com" || controller.signal.aborted) {
            throw error;
          }
          // Git LFS 的 raw 响应是文本指针，实际图片由 media 地址提供。
          const mediaUrl = new URL(url.href);
          mediaUrl.hostname = "media.githubusercontent.com";
          mediaUrl.pathname = `/media${url.pathname}`;
          originalFile = await readImage(mediaUrl);
        }
      } catch (error) {
        if (clipboardFile) {
          originalFile = clipboardFile;
        } else {
          message.error("无法读取网页原图，请将图片另存为文件后上传");
          return;
        }
      } finally {
        clearTimeout(timer);
      }
      uploadAdaptor({file: originalFile, content: content});
      return;
    }
  }
  for (const file of files) {
    uploadAdaptor({file, content: content});
  }
};
