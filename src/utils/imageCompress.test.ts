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
  PutObjectCommand: function(input) {
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
  bytes.set(
    Array.from("RIFF", (char) => char.charCodeAt(0)),
    0,
  );
  bytes[4] = 22;
  bytes.set(
    Array.from(`WEBP${chunk}`, (char) => char.charCodeAt(0)),
    8,
  );
  bytes[16] = 10;
  bytes[20] = flags;
  return bytes;
}

// 1x1 GIF with a global color table and complete image-data sub-blocks.
function gifBytes(frames = 1, signature = "GIF89a", comment: number[] = [], localColors = false) {
  const header = [...Array.from(signature, (char) => char.charCodeAt(0)), 1, 0, 1, 0, 0x80, 0, 0];
  const palette = [0, 0, 0, 255, 255, 255];
  const extension = comment.length ? [0x21, 0xfe, comment.length, ...comment, 0] : [];
  const frame = [
    0x2c,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    localColors ? 0x80 : 0,
    ...(localColors ? palette : []),
    2,
    2,
    0x44,
    0x01,
    0,
  ];
  return new Uint8Array([
    ...header,
    ...palette,
    ...extension,
    ...Array(frames)
      .fill(frame)
      .flat(),
    0x3b,
  ]);
}

function pngChunk(type: string, data = new Uint8Array()) {
  const bytes = new Uint8Array(data.length + 12);
  new DataView(bytes.buffer).setUint32(0, data.length);
  bytes.set(
    Array.from(type, (char) => char.charCodeAt(0)),
    4,
  );
  bytes.set(data, 8);
  return bytes;
}

function pngBytes(frames = 0, metadata = new Uint8Array()) {
  const chunks = [pngChunk("IHDR", new Uint8Array(13)), pngChunk("tEXt", metadata)];
  if (frames) {
    const animation = new Uint8Array(8);
    new DataView(animation.buffer).setUint32(0, frames);
    chunks.push(pngChunk("acTL", animation));
  }
  chunks.push(pngChunk("IDAT"), pngChunk("IEND"));
  return new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, ...chunks.flatMap((chunk) => Array.from(chunk))]);
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
      value: function() {
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
    const file = makeFile(gifBytes(2, signature), "animation.gif", "image/png");
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each(["image/gif", "image/png", ""])("compresses a single-frame GIF with MIME %s", async (type) => {
    const file = makeFile(gifBytes(), "still.gif", type);
    expect(await compressThenWebp(file)).toBe(compressed);
    expect(createImageBitmap).toHaveBeenCalledWith(file);
  });

  it("does not mistake GIF frame markers inside a comment for extra frames", async () => {
    const file = makeFile(gifBytes(1, "GIF89a", [0x2c, 0x21, 0xf9, 4, 0, 0, 0, 0, 0, 0x2c]), "still.gif", "image/gif");
    expect(await compressThenWebp(file)).toBe(compressed);
  });

  it("does not mistake GIF frame markers inside image data for extra frames", async () => {
    const bytes = gifBytes();
    bytes[bytes.length - 4] = 0x2c;
    bytes[bytes.length - 3] = 0x2c;
    expect(await compressThenWebp(makeFile(bytes, "still.gif", "image/gif"))).toBe(compressed);
  });

  it("counts GIF frames with local color tables", async () => {
    const file = makeFile(gifBytes(2, "GIF89a", [], true), "animation.gif", "image/gif");
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it("does not classify an unrelated file as animated from its MIME type", async () => {
    expect(await compressThenWebp(makeFile("not a GIF", "still.gif", "image/gif"))).toBe(compressed);
  });

  it("handles truncated GIF image data without hanging", async () => {
    const bytes = gifBytes().slice(0, -3);
    expect(await compressThenWebp(makeFile(bytes, "truncated.gif", "image/gif"))).toBe(compressed);
  });

  it.each(["image/png", "image/apng", ""])("preserves multi-frame APNG with MIME %s", async (type) => {
    const file = makeFile(pngBytes(2), "animation.png", type);
    expect(await compressThenWebp(file)).toBe(file);
    expect(createImageBitmap).not.toHaveBeenCalled();
  });

  it.each([0, 1])("compresses a PNG with %s animation frames", async (frames) => {
    expect(await compressThenWebp(makeFile(pngBytes(frames), "still.png", "image/png"))).toBe(compressed);
  });

  it("does not mistake PNG text metadata for an animation chunk", async () => {
    const fakeAnimation = pngChunk("acTL", new Uint8Array([0, 0, 0, 2, 0, 0, 0, 0]));
    expect(await compressThenWebp(makeFile(pngBytes(0, fakeAnimation), "still.png", "image/png"))).toBe(compressed);
  });

  it("ignores a truncated PNG animation chunk without reading beyond the file", async () => {
    const bytes = pngBytes(2).slice(0, 58);
    expect(await compressThenWebp(makeFile(bytes, "truncated.png", "image/png"))).toBe(compressed);
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
    ["animation.gif", "image/gif", gifBytes(2)],
    ["animation.webp", "image/webp", webpHeader("VP8X", 0x02)],
    ["animation.png", "image/png", pngBytes(2)],
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

  it.each([
    ["png", "image/png", "png"],
    ["gif", "image/gif", gifBytes()],
    ["webp", "image/webp", webpHeader("VP8X", 0x10)],
  ])("uploads static %s images as compressed WebP", async (extension, type, bytes) => {
    const onError = jest.fn();
    await r2Upload({file: makeFile(bytes, `still.${extension}`, type), onError});
    expect(onError).not.toHaveBeenCalled();
    expect(send.mock.calls[0][0].input).toEqual({
      Bucket: "test-bucket",
      Key: "still.webp",
      Body: new Uint8Array(await compressed.arrayBuffer()),
      ContentType: "image/webp",
    });
  });
});
