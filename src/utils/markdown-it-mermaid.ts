export default function markdownItMermaid(md) {
  const defaultFence = md.renderer.rules.fence;

  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const token = tokens[idx];
    const info = (token.info || "").trim();
    const lang = info.split(/\s+/)[0];

    if (lang === "mermaid") {
      const content = token.content.trim();
      return `<div class="mermaid">${md.utils.escapeHtml(content)}</div>`;
    }

    if (typeof defaultFence === "function") {
      return defaultFence(tokens, idx, options, env, slf);
    }

    return slf.renderToken(tokens, idx, options);
  };
}
