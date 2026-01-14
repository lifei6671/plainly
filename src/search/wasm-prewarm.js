import {ensureJiebaReady} from "./jieba-tokenizer";
/**
 * 后台预热 wasm：触发浏览器 HTTP 缓存
 * @param {{}} wasmUrl
 */
export default function prewarmWasm(wasmUrl) {
  if (!wasmUrl) return;

  // 不阻塞首屏：丢到空闲时间
  const run = async () => {
    try {
      // cache: 'force-cache' 尽量走缓存；首次会下载，后续命中
      const res = await fetch(wasmUrl, {cache: "force-cache"});
      if (!res.ok) return;
      // 读一遍 body，确保真正下载完成并可缓存
      await res.arrayBuffer();
      await ensureJiebaReady();
    } catch (_) {
      // 预热失败不影响主流程
    }
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => run(), {timeout: 5000});
  } else {
    setTimeout(run, 0);
  }
}
