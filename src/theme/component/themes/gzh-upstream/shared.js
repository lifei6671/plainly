/* eslint-disable */

export const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
export const SERIF = "'Noto Serif SC','Songti SC',STSong,Georgia,'Times New Roman',serif";
export const MONO = "Consolas,Menlo,Monaco,'Courier New',monospace";

const ORDINALS = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];

export function el(doc, tag, style, ...children) {
  const node = doc.createElement(tag);
  if (style) node.setAttribute('style', style);
  children.flat().filter(Boolean).forEach((child) => node.appendChild(child));
  return node;
}

export function sec(doc, style, ...children) { return el(doc, 'section', style, ...children); }
export function p(doc, style, ...children) { return el(doc, 'p', style, ...children); }
export function sp(doc, style, ...children) { return el(doc, 'span', style, ...children); }

export function leaf(doc) {
  const span = doc.createElement('span');
  span.setAttribute('leaf', '');
  span.appendChild(doc.createElement('br'));
  return span;
}

export function px(size, scale = 1) {
  return `${Math.round(size * scale * 100) / 100}px`;
}

export function splitHeadingText(text) {
  const raw = String(text || '').trim();
  const match = raw.match(/^(.+?)[｜|]\s*(.+)$/);
  if (!match) return { title: raw, tag: '' };
  return { title: match[1].trim(), tag: match[2].trim() };
}

export function splitCoverHeadingText(text) {
  const parts = String(text || '')
    .split(/[｜|]/)
    .map((part) => part.trim());
  const named = {};
  const positional = [];

  parts.slice(1).forEach((part) => {
    const match = part.match(/^([a-zA-Z][\w-]*)\s*=\s*(.*)$/);
    if (match) named[match[1]] = match[2].trim();
    else positional.push(part);
  });

  return {
    title: parts[0] || '',
    tag: named.tag || positional[0] || '',
    label: named.label || '',
    subtitle: named.subtitle || '',
    summary: named.summary || named.description || '',
    coverImage: named.coverImage || named.coverimage || '',
    footer: named.footer || positional[1] || '',
    footerRight: named.footerRight || named.footerright || '',
    date: named.date || positional[2] || '',
    author: named.author || positional.slice(3).filter(Boolean).join(' | '),
    authorBio: named.authorBio || named.authorbio || '',
    stars: named.stars || '',
    issue: named.issue || '',
    aside: named.aside || '',
    grade: named.grade || '',
    tags: named.tags || ''
  };
}

export function chapterNumber(index) {
  return String(index + 1).padStart(2, '0');
}

export function chapterOrdinal(index) {
  return ORDINALS[index] || `CHAPTER ${index + 1}`;
}

export function inlineContentOf(node) {
  const nodes = [];
  while (node.firstChild && node.firstChild.nodeType !== 1) {
    nodes.push(node.removeChild(node.firstChild));
  }
  return nodes;
}

export function splitListItem(item) {
  const clone = item.cloneNode(true);
  clone.querySelectorAll('p').forEach((child) => {
    const parent = child.parentNode;
    while (child.firstChild) parent.insertBefore(child.firstChild, child);
    parent.removeChild(child);
  });
  const text = (clone.textContent || '').replace(/\s+/g, ' ').trim();
  const colon = text.match(/^(.{1,14}?)\s*[：:]\s*(.+)$/);
  if (colon) {
    let descriptionNodes = null;
    const first = clone.firstChild;
    if (first && first.nodeType === 3) {
      const stripped = first.nodeValue.replace(/^\s*[^：:]{1,14}?\s*[：:]\s*/, '');
      if (first.nodeValue !== stripped && !/^[：:]/.test(stripped)) {
        first.nodeValue = stripped;
        descriptionNodes = Array.from(clone.childNodes).filter((node) => {
          if (node.nodeType !== 3) return true;
          return Boolean((node.nodeValue || '').trim());
        });
        if (descriptionNodes.length === 0) descriptionNodes = null;
      }
    }
    return { label: colon[1], description: colon[2], descriptionNodes };
  }
  if (text.length <= 12) return { label: text, description: '', descriptionNodes: null };
  return { label: '', description: text, descriptionNodes: null };
}

export function bodyChildren(doc, predicate) {
  return Array.from(doc.body.children).filter(predicate);
}

export function isHeading(tagName) {
  return /^H[1-6]$/.test(tagName || '');
}

export function isInPreface(node) {
  let sibling = node.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === 'H2' || sibling.tagName === 'H1') return sibling.tagName === 'H1';
    sibling = sibling.previousElementSibling;
  }
  return true;
}

export function currentDateStamp() {
  const now = new Date();
  return `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function extractQuoteParts(blockquote) {
  const paras = Array.from(blockquote.querySelectorAll('p'));
  if (paras.length === 0) {
    return { body: [blockquote], signature: null };
  }
  let signature = null;
  const last = paras[paras.length - 1];
  const lastText = (last.textContent || '').trim();
  if (paras.length > 1 && /^——|^——/.test(lastText) && lastText.length <= 20) {
    signature = lastText;
    paras.pop();
  }
  return { body: paras, signature };
}

export function moveChildren(from, to) {
  while (from.firstChild) to.appendChild(from.firstChild);
}

export function restyleHeading(heading, style) {
  heading.setAttribute('style', style);
  return heading;
}

export function buildCtaCard(doc, scale, skin) {
  const interaction = skin.interaction || {};
  const icons = [
    { label: interaction.footerCtaLikeLabel || '点赞', svg: '<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path>', accent: false },
    { label: interaction.footerCtaReadLabel || '在看', svg: '<circle cx="12" cy="12" r="3"></circle><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>', accent: false },
    { label: interaction.footerCtaShareLabel || skin.thirdLabel || '转发', svg: skin.thirdIcon || '<path d="M4 18v-4a8 8 0 0 1 8-8h8"></path><polyline points="16 2 20 6 16 10"></polyline>', accent: true }
  ];

  const iconNodes = icons.map((icon) => {
    const box = sec(doc,
      `width:40px;height:40px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;${icon.accent ? skin.accentBox : skin.box}`,
      iconSvg(doc, icon.svg, icon.accent ? skin.accentColor : undefined));
    return sec(doc, `text-align:center;${icon.accent ? `color:${skin.accentColor};` : `color:${skin.iconColor};`}`,
      box,
      sp(doc, `font-size:${px(10, scale)};font-weight:600;`, doc.createTextNode(icon.label)));
  });

  const card = sec(doc, skin.card,
    p(doc, `font-size:${px(skin.fontSize || 13, scale)};font-weight:${skin.leadWeight || 700};color:${skin.leadColor};margin:0 0 20px;line-height:1.6;text-align:center;`,
      doc.createTextNode(interaction.footerCtaLead || skin.leadText || '既然看到这里了，如果觉得有用，随手点个赞、在看、转发三连吧。')),
    sec(doc, 'display:flex;justify-content:center;gap:24px;margin-bottom:16px;', iconNodes),
    skin.footer || null);
  return card;
}

function iconSvg(doc, paths, color) {
  const wrapper = doc.createElement('span');
  wrapper.setAttribute('style', 'display:inline-flex;line-height:0;');
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('width', '18');
  svg.setAttribute('height', '18');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.8');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (color) svg.setAttribute('style', `color:${color};`);
  wrapper.appendChild(svg);
  const parsed = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${paths}</svg>`, 'image/svg+xml');
  Array.from(parsed.documentElement.childNodes).forEach((childNode) => {
    svg.appendChild(doc.importNode(childNode, true));
  });
  return wrapper;
}

