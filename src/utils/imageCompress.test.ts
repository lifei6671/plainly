declare const jest: any;
declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;

jest.mock("qiniu-js", () => ({}));
jest.mock("antd", () => ({message: {loading: jest.fn(), destroy: jest.fn(), success: jest.fn(), error: jest.fn()}}));
jest.mock("axios", () => ({}));
jest.mock("ali-oss", () => ({}));
jest.mock("@tauri-apps/api/tauri", () => ({}));
jest.mock("../store/imageHosting", () => ({}));
jest.mock("./helper", () => ({}));
jest.mock("./qiuniu", () => ({}));
jest.mock("./configStore", () => ({}));
jest.mock("./constant", () => ({R2_IMAGE_HOSTING: "r2_image_hosting"}));
jest.mock("../component/ImageHosting/configSync", () => ({
  resolveHostingConfig: async () => ({
    accountId: "test-account",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
    bucket: "test-bucket",
    publicBaseUrl: "https://images.example.com/",
    filenameTemplate: "${NAME}.${EXT}",
    size: 100,
  }),
}));
jest.mock("@aws-sdk/client-s3", () => ({
  S3Client: jest.fn(),
  PutObjectCommand: function (input) {
    this.input = input;
  },
}));

import compressThenWebp from "./imageCompress";
import {r2Upload} from "./imageHosting";
import {S3Client} from "@aws-sdk/client-s3";

function makeFile(bytes: BlobPart, name: string, type: string) {
  return new File([bytes], name, {type});
}

function webpHeader(chunk = "VP8X", flags = 0) {
  const bytes = new Uint8Array(30);
  bytes.set(Array.from("RIFF", (char) => char.charCodeAt(0)), 0);
  bytes[4] = 22;
  bytes.set(Array.from(`WEBP${chunk}`, (char) => char.charCodeAt(0)), 8);
  bytes[16] = 10;
  bytes[20] = flags;
  return bytes;
}

describe("animation-preserving image uploads", () => {
  let bitmapDescriptor: PropertyDescriptor | undefined;
  let arrayBufferDescriptor: PropertyDescriptor | undefined;
  let drawImage: any;
  let send: any;
  let compressed: Blob;

  beforeEach(() => {
    jest.useFakeTimers();
    arrayBufferDescriptor = Object.getOwnPropertyDescriptor(Blob.prototype, "arrayBuffer");
    // Jest's jsdom predates Blob.arrayBuffer; use its real FileReader for the bytes.
    Object.defineProperty(Blob.prototype, "arrayBuffer", {
      configurable: true,
      value: function () {
        return new Promise<ArrayBuffer>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as ArrayBuffer);
          reader.onerror = () => reject(reader.error);
          reader.readAsArrayBuffer(this);
        });
      },
    });
    bitmapDescriptor = Object.getOwnPropertyDescriptor(window, "createImageBitmap");
    Object.defineProperty(window, "createImageBitmap", {
      configurable: true,
      value: jest.fn(async () => ({width: 400, height: 200})),
    });
    compressed = makeFile("compressed", "output.webp", "image/webp");
    drawImage = jest.fn();
    jest.spyOn(HTMLCanvasElement.prototype, "getContext").mockImplementation(() => ({drawImage}));
    jest.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation((callback) => callback(compressed));
    send = jest.fn(async () => ({}));
    (S3Client as any).mockImplementation(() => ({send}));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    if (arrayBufferDescriptor) {
      Object.defineProperty(Blob.prototype, "arrayBuffer", arrayBufferDescriptor);
    } else {
      delete Blob.prototype.arrayBuffer;
    }
    if (bitmapDescriptor) {
      Object.defineProperty(window, "createImageBitmap", bitmapDescriptor);
    } else {
      delete (window as any).createImageBitmap;
    }
  });

  it.each(["GIF87a", "GIF89a"])("preserves %s bytes even with a misleading MIME type", async (signature) => {
    const file = makeFile(signature, "animation.gif", "image/png");
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("skips GIF files by MIME type", async () => {
    const file = makeFile("gif", "animation.gif", "image/gif");
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each(["image/webp", "image/png", ""])("preserves animated WebP with MIME %s", async (type) => {
    const file = makeFile(webpHeader("VP8X", 0x12), "animation.webp", type);
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each(["VP8 ", "VP8L", "VP8X"])("continues compressing static %s WebP", async (chunk) => {
    const file = makeFile(webpHeader(chunk, 0x10), "still.webp", "image/webp");
    expect(await compressThenWebp(file, {maxWidth: 100, maxHeight: 100})).toBe(compressed);
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 100, 50);
  });

  it.each(["image/png", "image/jpeg"])("continues compressing %s", async (type) => {
    expect(await compressThenWebp(makeFile("still", "still", type))).toBe(compressed);
  });

  it("does not treat an unrelated RIFF file as animated WebP", async () => {
    const bytes = webpHeader("VP8X", 0x02);
    bytes[8] = 0;
    expect(await compressThenWebp(makeFile(bytes, "still.png", "image/png"))).toBe(compressed);
  });

  it.each([
    ["animation.gif", "image/gif", "GIF89a"],
    ["animation.webp", "image/webp", webpHeader("VP8X", 0x02)],
  ])("uploads %s with original bytes, extension and content type", async (name, type, bytes) => {
    const file = makeFile(bytes, name, type);
    const onError = jest.fn();
    const onSuccess = jest.fn();
    const images = [];
    await r2Upload({file, onError, onSuccess, images});
    expect(onError).not.toHaveBeenCalled();
    expect(onSuccess).toHaveBeenCalled();
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "test-bucket",
      Key: name,
      Body: new Uint8Array(await file.arrayBuffer()),
      ContentType: type,
    });
    expect(images).toEqual([{filename: "animation", url: `https://images.example.com/${name}`}]);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("uploads static images as compressed WebP", async () => {
    const onError = jest.fn();
    await r2Upload({file: makeFile("png", "still.png", "image/png"), onError});
    expect(onError).not.toHaveBeenCalled();
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "test-bucket",
      Key: "still.webp",
      Body: new Uint8Array(await compressed.arrayBuffer()),
      ContentType: "image/webp",
    });
  });
});
