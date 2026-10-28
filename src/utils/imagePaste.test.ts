declare const jest: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const describe: any;

jest.mock("antd", () => ({message: {error: jest.fn(), warning: jest.fn()}}));
jest.mock("./imageHosting", () => ({uploadAdaptor: jest.fn()}));

import {message} from "antd";
import {uploadAdaptor} from "./imageHosting";
import {pasteImages} from "./imagePaste";

const props = {content: {setContent: jest.fn()}};
beforeEach(() => jest.clearAllMocks());

describe("pasting images copied from a web page", () => {
  const source = "https://raw.githubusercontent.com/alchaincyf/huashu-motion/main/docs/media/hero.gif";
  let fetchDescriptor: PropertyDescriptor | undefined;
  let abortDescriptor: PropertyDescriptor | undefined;
  let fetchImage: any;

  beforeEach(() => {
    fetchDescriptor = Object.getOwnPropertyDescriptor(window, "fetch");
    fetchImage = jest.fn().mockResolvedValue({ok: true, blob: async () => new Blob(["GIF89a"], {type: "image/gif"})});
    Object.defineProperty(window, "fetch", {configurable: true, value: fetchImage});
    abortDescriptor = Object.getOwnPropertyDescriptor(window, "AbortController");
    Object.defineProperty(window, "AbortController", {
      configurable: true,
      value: class {
        signal = {};
        abort() {}
      },
    });
  });

  afterEach(() => {
    if (abortDescriptor) {
      Object.defineProperty(window, "AbortController", abortDescriptor);
    } else {
      delete (window as any).AbortController;
    }
    if (fetchDescriptor) {
      Object.defineProperty(window, "fetch", fetchDescriptor);
    } else {
      delete (window as any).fetch;
    }
  });

  const pasteEvent = (html: string, files: File[] = [new File(["png"], "image.png", {type: "image/png"})]) => ({
    clipboardData: {files, getData: (type) => (type === "text/html" ? html : "")},
    preventDefault: jest.fn(),
  });

  it.each([
    ["GIF89a", "image/png", "image/gif"],
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), "application/octet-stream", "image/png"],
    [new Uint8Array([255, 216, 255, 224]), "", "image/jpeg"],
    ["RIFF1234WEBPVP8X", "image/png", "image/webp"],
    ["BM1234", "application/octet-stream", "image/bmp"],
  ])("identifies original image bytes despite MIME %s and a misleading URL", async (bytes, mime, expectedType) => {
    fetchImage.mockResolvedValue({ok: true, blob: async () => new Blob([bytes], {type: mime})});
    await pasteImages(props.content, pasteEvent('<img src="https://images.example.com/wrong.png">', []));
    const file = (uploadAdaptor as any).mock.calls[0][0]?.file;
    expect(file?.type).toBe(expectedType);
    expect(file?.size).toBe(new Blob([bytes]).size);
    expect(message.warning).not.toHaveBeenCalled();
  });

  it("recognizes an original GIF mislabeled as a clipboard PNG without downloading it again", async () => {
    const event = pasteEvent(`<img src="${source}">`, [new File(["GIF89a"], "image.png", {type: "image/png"})]);
    await pasteImages(props.content, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fetchImage).not.toHaveBeenCalled();
    const file = (uploadAdaptor as any).mock.calls[0][0]?.file;
    expect(file?.type).toBe("image/gif");
    expect(file?.name).toBe("image.gif");
    expect(file?.size).toBe(6);
  });

  it("uploads the original GIF instead of the clipboard PNG snapshot", async () => {
    const event = pasteEvent(`<img src="${source}">`);
    await pasteImages(props.content, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(fetchImage).toHaveBeenCalledWith(source, expect.objectContaining({credentials: "omit"}));
    const file = (uploadAdaptor as any).mock.calls[0][0].file;
    expect(file.name).toBe("hero.gif");
    expect(file.type).toBe("image/gif");
    const data = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.readAsText(file);
    });
    expect(data).toBe("GIF89a");
  });

  it("recovers WebP originals from extensionless URLs", async () => {
    fetchImage.mockResolvedValue({ok: true, blob: async () => new Blob(["webp"], {type: "image/webp"})});
    await pasteImages(props.content, pasteEvent('<img src="https://images.example.com/animation">'));
    const file = (uploadAdaptor as any).mock.calls[0][0].file;
    expect(file.type).toBe("image/webp");
    expect(file.name).toBe("animation.webp");
  });

  it("reads GitHub raw links through the CORS-enabled original host", async () => {
    const event = pasteEvent('<img src="https://github.com/alchaincyf/huashu-motion/raw/main/docs/media/hero.gif">');
    await pasteImages(props.content, event);
    expect(fetchImage).toHaveBeenCalledWith(source, expect.objectContaining({credentials: "omit"}));
  });

  it("reads GitHub LFS images from the media host instead of uploading the pointer", async () => {
    const image = "https://github.com/baidu/Unlimited-OCR/raw/main/assets/Unlimited-OCR2.png";
    fetchImage
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["version https://git-lfs.github.com/spec/v1"], {type: "text/plain"}),
      })
      .mockResolvedValueOnce({ok: true, blob: async () => new Blob(["original png"], {type: "image/png"})});
    await pasteImages(props.content, pasteEvent(`<img src="${image}">`));
    expect(fetchImage.mock.calls.map(([url]) => url)).toEqual([
      "https://raw.githubusercontent.com/baidu/Unlimited-OCR/main/assets/Unlimited-OCR2.png",
      "https://media.githubusercontent.com/media/baidu/Unlimited-OCR/main/assets/Unlimited-OCR2.png",
    ]);
    expect(uploadAdaptor).toHaveBeenCalledTimes(1);
    const file = (uploadAdaptor as any).mock.calls[0][0].file;
    expect(file.name).toBe("Unlimited-OCR2.png");
    expect(file.type).toBe("image/png");
    expect(file.size).toBe("original png".length);
    expect(message.error).not.toHaveBeenCalled();
  });

  it.each(["gif", "webp"])("recovers a GitHub %s original after the raw connection fails", async (extension) => {
    const image = `https://raw.githubusercontent.com/owner/repo/main/animation.${extension}`;
    fetchImage
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(["original animation"], {type: `image/${extension}`}),
      });
    await pasteImages(props.content, pasteEvent(`<img src="${image}">`));
    expect(fetchImage).toHaveBeenLastCalledWith(
      `https://media.githubusercontent.com/media/owner/repo/main/animation.${extension}`,
      expect.objectContaining({credentials: "omit"}),
    );
    const file = (uploadAdaptor as any).mock.calls[0][0].file;
    expect(file.type).toBe(`image/${extension}`);
    expect(file.size).toBe("original animation".length);
  });

  it("uploads the clipboard PNG when a static image cannot be downloaded", async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    const file = new File(["clipboard png"], "image.png", {type: "image/png"});
    const event = pasteEvent('<img src="https://images.example.com/photo.PNG?download=1">', [file]);
    await pasteImages(props.content, event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(uploadAdaptor).toHaveBeenCalledWith({file, content: props.content});
    expect(message.error).not.toHaveBeenCalled();
  });

  it("uses the clipboard PNG when both GitHub image hosts are unavailable", async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    const file = new File(["clipboard png"], "image.png", {type: "image/png"});
    await pasteImages(
      props.content,
      pasteEvent('<img src="https://github.com/baidu/Unlimited-OCR/raw/main/assets/Unlimited-OCR2.png">', [file]),
    );
    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(uploadAdaptor).toHaveBeenCalledWith({file, content: props.content});
  });

  const wechatImage =
    "https://mmbiz.qpic.cn/mmbiz_png/2jjfQoZLoqUNSHKpAn1zLHlEkM64QFApK0pl64fiaUnibXQvjykUQTVIWBsH2craxEdwFKHudcKNCicQBMyiapiavHefvxIls3xvaGicmTiaOP5624/640?wx_fmt=png&from=appmsg";

  it.each([wechatImage, "https://mmbiz.qpic.cn/mmbiz_jpg/photo/640?wx_fmt=jpeg"])(
    "uploads the clipboard PNG when the WeChat static original is unreadable: %s",
    async (sourceUrl) => {
      fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
      const file = new File(["clipboard png"], "image.png", {type: "image/png"});
      const event = pasteEvent(`<img src="${sourceUrl}">`, [file]);
      await pasteImages(props.content, event);
      expect(event.preventDefault).toHaveBeenCalled();
      expect(uploadAdaptor).toHaveBeenCalledTimes(1);
      expect(uploadAdaptor).toHaveBeenCalledWith({file, content: props.content});
      expect(message.error).not.toHaveBeenCalled();
    },
  );

  it("still prefers a readable WeChat original over the clipboard copy", async () => {
    fetchImage.mockResolvedValue({ok: true, blob: async () => new Blob(["original png"], {type: "image/png"})});
    await pasteImages(props.content, pasteEvent(`<img src="${wechatImage}">`));
    const file = (uploadAdaptor as any).mock.calls[0][0].file;
    expect(file.type).toBe("image/png");
    expect(file.size).toBe("original png".length);
    expect(message.error).not.toHaveBeenCalled();
  });

  it("reports an unreadable WeChat static original when there is no clipboard image", async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    await pasteImages(props.content, pasteEvent(`<img src="${wechatImage}">`, []));
    expect(uploadAdaptor).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith("无法读取网页原图，请将图片另存为文件后上传");
  });

  it.each([
    "https://mmbiz.qpic.cn/mmbiz_gif/animation/640?wx_fmt=gif",
    "https://mmbiz.qpic.cn/mmbiz_webp/animation/640?wx_fmt=webp",
    "https://mmbiz.qpic.cn/mmbiz/animation/640",
    "https://images.example.com/mmbiz_png/animation/640",
  ])("uses the clipboard image even when the source format is unknown: %s", async (sourceUrl) => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    await pasteImages(props.content, pasteEvent(`<img src="${sourceUrl}">`));
    expect(uploadAdaptor).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith("无法读取网页原图，已使用剪贴板图片，动画可能丢失");
  });

  it("reports an unreadable static original when the clipboard contains no image file", async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    await pasteImages(props.content, pasteEvent('<img src="https://images.example.com/photo.png">', []));
    expect(uploadAdaptor).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalledWith("无法读取网页原图，请将图片另存为文件后上传");
  });

  it.each(["animation.gif", "animation.webp", "animation"])(
    "uses the clipboard PNG with a warning when %s is unreadable",
    async (path) => {
      fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
      await pasteImages(props.content, pasteEvent(`<img src="https://images.example.com/${path}">`));
      expect(fetchImage).toHaveBeenCalledTimes(1);
      expect(uploadAdaptor).toHaveBeenCalledTimes(1);
      expect(message.warning).toHaveBeenCalledWith("无法读取网页原图，已使用剪贴板图片，动画可能丢失");
    },
  );

  it.each(["gif", "webp"])("uses the clipboard PNG when both GitHub %s hosts fail", async (extension) => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    await pasteImages(
      props.content,
      pasteEvent(`<img src="https://github.com/owner/repo/raw/main/animation.${extension}">`),
    );
    expect(fetchImage).toHaveBeenCalledTimes(2);
    expect(uploadAdaptor).toHaveBeenCalledTimes(1);
    expect(message.warning).toHaveBeenCalledWith("无法读取网页原图，已使用剪贴板图片，动画可能丢失");
  });

  it("handles an image-only HTML fragment without a clipboard file", async () => {
    await pasteImages(props.content, pasteEvent(`<img src="${source}">`, []));
    expect(uploadAdaptor).toHaveBeenCalledWith(
      expect.objectContaining({file: expect.objectContaining({type: "image/gif"})}),
    );
  });

  it.each(["gif", "webp"])("keeps an original %s file without fetching its HTML source again", async (extension) => {
    const file = new File(["original animation"], `original.${extension}`, {type: `image/${extension}`});
    await pasteImages(props.content, pasteEvent(`<img src="${source}">`, [file]));
    expect(fetchImage).not.toHaveBeenCalled();
    expect(uploadAdaptor).toHaveBeenCalledWith({file, content: props.content});
  });

  it("keeps multiple pasted files in order", async () => {
    const files = [new File(["a"], "a.png", {type: "image/png"}), new File(["b"], "b.png", {type: "image/png"})];
    await pasteImages(props.content, pasteEvent(`<img src="${source}">`, files));
    expect(fetchImage).not.toHaveBeenCalled();
    expect((uploadAdaptor as any).mock.calls.map(([options]) => options.file)).toEqual(files);
  });

  it("leaves mixed article text and images to normal text paste", async () => {
    const event = pasteEvent(`<p>article text</p><img src="${source}">`, []);
    await pasteImages(props.content, event);
    expect(fetchImage).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(uploadAdaptor).not.toHaveBeenCalled();
  });

  it("uses the clipboard file unchanged when the original is unreadable", async () => {
    fetchImage.mockRejectedValue(new TypeError("Failed to fetch"));
    const event = pasteEvent(`<img src="${source}">`);
    await pasteImages(props.content, event);
    expect(uploadAdaptor).toHaveBeenCalledWith({file: event.clipboardData.files[0], content: props.content});
    expect(message.warning).toHaveBeenCalledWith("无法读取网页原图，已使用剪贴板图片，动画可能丢失");
  });

  it.each([
    {ok: false, blob: async () => new Blob(["GIF89a"], {type: "image/gif"})},
    {ok: true, blob: async () => new Blob(["not an image"], {type: "text/html"})},
  ])("does not upload a failed or non-image original response", async (response) => {
    fetchImage.mockResolvedValue(response);
    await pasteImages(props.content, pasteEvent(`<img src="${source}">`, []));
    expect(uploadAdaptor).not.toHaveBeenCalled();
    expect(message.error).toHaveBeenCalled();
  });
});
