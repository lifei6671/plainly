/* eslint-disable */
import { applyComponentFlow } from './engine.js';
import {
  sec, p, sp, leaf, px, moveChildren, SANS, MONO
} from './shared.js';

const BLUE = '#1B3A8C';
const INK = '#1A1A1A';
const BLACK = '#111111';
const GREY = '#D9D9D9';
const SERIF = "Georgia,'Songti SC','STSong',serif";
const LABEL = "Arial,'PingFang SC',sans-serif";

function cover(h1, { scale, tag, label, subtitle, issue, footer, footerRight, author }) {
  const doc = h1.ownerDocument;
  const masthead = [label, issue].filter(Boolean).join(' · ');
  const summary = subtitle || tag;
  const footerEnd = footerRight || author;
  h1.setAttribute('style', `margin:0 0 14px 0;font-size:${px(24, scale)};font-weight:700;line-height:1.4;color:#FFFFFF;font-family:${SERIF};`);

  return sec(doc, 'margin:0 0 28px 0;padding:36px 22px 30px 22px;background-color:#111111;',
    masthead ? p(doc, 'margin:0 0 12px 0;',
      sp(doc, `display:inline-block;padding:2px 10px;border:1px solid #FFFFFF;color:#FFFFFF;font-size:${px(11, scale)};letter-spacing:2px;font-family:${LABEL};`,
        doc.createTextNode(masthead))) : null,
    h1,
    p(doc, 'margin:0 0 14px 0;width:44px;height:3px;background-color:#5B7FD6;font-size:0;line-height:0;', leaf(doc)),
    summary ? p(doc, `margin:0;font-family:${LABEL};font-size:${px(13, scale)};line-height:1.7;color:#BFBFBF;`, doc.createTextNode(summary)) : null,
    footer || footerEnd ? p(doc, `margin:${summary ? '14px' : '0'} 0 0;font-family:${LABEL};font-size:${px(11, scale)};line-height:1.5;color:#8F8F8F;display:flex;justify-content:space-between;gap:12px;`,
      sp(doc, '', footer ? doc.createTextNode(footer) : null),
      footerEnd ? sp(doc, 'margin-left:auto;text-align:right;', doc.createTextNode(footerEnd)) : null) : null
  );
}

function introQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, 'margin:0 0 28px 0;padding:0 22px;',
    p(doc, `margin:0 0 8px 0;font-family:${LABEL};font-size:${px(12, scale)};font-weight:700;color:${BLUE};letter-spacing:2px;`, doc.createTextNode('摘要 SUMMARY')));
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P' && child !== card.firstElementChild).forEach((para, index, all) => {
    para.setAttribute('style', `margin:0;font-size:${px(16, scale)};line-height:1.75;color:${INK};font-weight:600;${index === all.length - 1 ? '' : 'margin-bottom:10px;'}`);
  });
  return card;
}

function toc(items, { scale, doc }) {
  const rows = items.slice(0, 4).map((item, index) => {
    const top = index === 0 ? 'border-top:1px solid #1A1A1A;' : '';
    return p(doc, `margin:0;padding:14px 0;border-bottom:1px solid ${GREY};${top}display:flex;align-items:baseline;`,
      sp(doc, `font-family:Georgia,serif;font-size:${px(20, scale)};font-weight:700;color:${BLUE};margin-right:12px;`, doc.createTextNode(item.number)),
      sp(doc, `font-size:${px(14, scale)};color:${INK};`, doc.createTextNode(item.title)));
  });
  return sec(doc, 'margin:0 0 28px 0;padding:0 22px;', rows);
}

function chapter(h2, { index, number, tag, scale }) {
  const doc = h2.ownerDocument;
  h2.setAttribute('style', `font-size:${px(18, scale)};font-weight:700;color:${INK};font-family:${SERIF};line-height:1.4;`);

  const row = sec(doc, `display:flex;align-items:baseline;border-bottom:2px solid ${INK};padding-bottom:10px;`,
    sp(doc, `font-family:Georgia,serif;font-size:${px(22, scale)};font-weight:700;color:${BLUE};margin-right:10px;`, doc.createTextNode(number)),
    h2);
  return sec(doc, `margin:${index === 0 ? '32px' : '44px'} 0 24px 0;padding:0 22px;`,
    tag ? p(doc, `margin:0 0 6px 0;font-family:${LABEL};font-size:${px(11, scale)};color:#6B6B6B;letter-spacing:1.5px;`, doc.createTextNode(tag)) : null,
    row);
}

function h3sub(h3, { scale }) {
  const doc = h3.ownerDocument;
  const title = sp(doc, `font-size:${px(15, scale)};font-weight:700;color:${INK};`);
  moveChildren(h3, title);
  h3.setAttribute('style', `margin:24px 0 20px 0;padding:0 22px;font-family:${SERIF};line-height:1.5;`);
  h3.appendChild(title);
  return h3;
}

function blockQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `margin:0 0 24px 0;padding:14px 18px;border-left:3px solid ${BLUE};`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `margin:${index === all.length - 1 ? '0' : '0 0 8px 0'};font-size:${px(14, scale)};line-height:1.85;color:#333333;font-style:italic;`);
  });
  return card;
}

function unorderedList(ul, { scale, doc }) {
  const rows = Array.from(ul.children).filter((child) => child.tagName === 'LI').map((item, index, all) => {
    const row = p(doc, `margin:${index === all.length - 1 ? '0' : '0 0 8px 0'};padding-left:14px;border-left:2px solid ${GREY};font-size:${px(14, scale)};color:${INK};`);
    moveChildren(item, row);
    return row;
  });
  return [sec(doc, 'margin:0 0 22px 0;padding:0 22px;', rows)];
}

function orderedList(ol, { scale, doc }) {
  const rows = Array.from(ol.children).filter((child) => child.tagName === 'LI').map((item, index, all) => {
    const row = p(doc, `margin:${index === all.length - 1 ? '0' : '0 0 8px 0'};display:flex;`,
      sp(doc, `font-family:Georgia,serif;font-size:${px(13, scale)};font-weight:700;color:${BLUE};margin-right:8px;`, doc.createTextNode(`${index + 1}.`)));
    const content = sp(doc, `font-size:${px(14, scale)};color:${INK};`);
    moveChildren(item, content);
    row.appendChild(content);
    return row;
  });
  return [sec(doc, 'margin:0 0 22px 0;padding:0 22px;', rows)];
}

function divider(rule, { scale }) {
  const doc = rule.ownerDocument;
  return sec(doc, 'margin:0 0 22px 0;padding:0 22px;text-align:center;',
    p(doc, `margin:0;font-family:Georgia,serif;font-size:${px(14, scale)};color:${BLUE};letter-spacing:6px;`, doc.createTextNode('· · ·')));
}

function cta({ scale, doc, displaySettings }) {
  const lead = displaySettings?.footerCtaLead || '如果这篇内容对你有帮助，欢迎点赞、在看、转发三连。';
  const like = displaySettings?.footerCtaLikeLabel || '点赞';
  const read = displaySettings?.footerCtaReadLabel || '在看';
  const share = displaySettings?.footerCtaShareLabel || '转发';
  const iconBox = (label, accent) => sec(doc,
    `text-align:center;color:${accent ? BLUE : '#8A8A8A'};`,
    sec(doc, `width:38px;height:38px;display:flex;align-items:center;justify-content:center;margin:0 auto 6px;border:1px solid ${accent ? BLUE : '#FFFFFF'};`,
      sp(doc, `font-family:Georgia,serif;font-size:${px(14, scale)};color:${accent ? BLUE : '#FFFFFF'};`, doc.createTextNode(accent ? '★' : '·'))),
    sp(doc, `font-family:${LABEL};font-size:${px(10, scale)};color:#FFFFFF;letter-spacing:1px;`, doc.createTextNode(label)));

  return sec(doc, 'margin:0 0 24px 0;padding:20px 22px;background-color:#111111;',
    p(doc, `margin:0 0 14px 0;font-size:${px(15, scale)};line-height:1.7;color:#FFFFFF;font-family:${SERIF};`, doc.createTextNode(lead)),
    sec(doc, 'display:flex;justify-content:center;gap:24px;margin-bottom:14px;',
      iconBox(like, false), iconBox(read, false), iconBox(share, true)),
    p(doc, `margin:0;font-family:${LABEL};font-size:${px(11, scale)};color:#7A7A7A;letter-spacing:1.5px;text-align:center;`, doc.createTextNode('THANKS FOR READING')));
}

export const monoBlueEditorialTheme = {
  name: '墨蓝刊读风',
  preserveQuoteColors: true,
  styles: {
    container: `width:100%;max-width:none;box-sizing:border-box;margin:0 auto;padding:16px 0 32px;background-color:#FFFFFF !important;color:${INK} !important;font-family:${SERIF};line-height:1.8;overflow-wrap:anywhere;`,
    h1: `margin:0 0 28px;padding:0 22px;font-family:${SERIF};font-size:24px;font-weight:700;line-height:1.4;color:${INK} !important;`,
    h2: `margin:44px 0 24px;padding:0 22px;font-family:${SERIF};font-size:18px;font-weight:700;line-height:1.4;color:${INK} !important;`,
    h3: `margin:24px 0 20px;padding:0 22px;font-family:${SERIF};font-size:15px;font-weight:700;line-height:1.5;color:${INK} !important;`,
    h4: `margin:22px 0 16px;padding:0 22px;font-family:${SERIF};font-size:15px;font-weight:700;line-height:1.5;color:${INK} !important;`,
    h5: `margin:18px 0 12px;padding:0 22px;font-family:${LABEL};font-size:13px;font-weight:700;color:${INK} !important;letter-spacing:1px;`,
    h6: `margin:16px 0 10px;padding:0 22px;font-family:${LABEL};font-size:12px;font-weight:700;color:#6B6B6B !important;letter-spacing:1px;`,
    p: `margin:0 0 22px;padding:0 22px;font-size:15px;line-height:1.95;color:${INK} !important;text-align:justify;`,
    strong: `font-weight:700;color:${INK} !important;`,
    em: 'font-style:italic;color:#4A4A4A !important;',
    a: `color:${BLUE} !important;font-weight:600;text-decoration:underline;overflow-wrap:break-word;`,
    u: `text-decoration:none;border-bottom:2px solid ${BLUE};font-weight:600;color:${INK};`,
    mark: `background-color:#F0F0F0;color:${BLUE};padding:1px 6px;font-weight:600;`,
    s: 'color:#8A8A8A;text-decoration:line-through;',
    ul: 'margin:0 0 22px;padding:0 22px;',
    ol: 'margin:0 0 22px;padding:0 22px;',
    li: `font-size:14px;line-height:1.85;color:${INK} !important;`,
    'li p': 'margin:6px 0;',
    blockquote: `margin:0 22px 24px;padding:14px 18px;border-left:3px solid ${BLUE};`,
    'blockquote p': 'margin:0 0 8px;font-size:14px;color:#333333 !important;font-style:italic;',
    code: `font-family:'Courier New',${MONO};font-size:13px;background-color:#F0F0F0;color:${BLUE};padding:1px 6px;`,
    pre: `margin:24px 0;padding:16px 18px;background-color:${BLACK};color:#DDDDDD;border:0;border-radius:0;overflow-x:auto;line-height:1.6;`,
    hr: `margin:28px 0;border:0;`,
    img: 'display:block;max-width:100%;height:auto;margin:22px auto;border-radius:0;',
    table: 'width:100%;border-collapse:collapse;font-size:13px;',
    th: `padding:8px 6px;text-align:left;border-bottom:2px solid ${INK};font-family:${LABEL};font-weight:700;color:${INK};`,
    td: `padding:8px 6px;border-bottom:1px solid ${GREY};color:#333333;line-height:1.8;`,
    tr: 'border:0;'
  },
  transform(doc, ctx) {
    applyComponentFlow(doc, ctx, {
      cover,
      toc,
      chapter,
      h3sub,
      introQuote,
      quote: blockQuote,
      unorderedList,
      orderedList,
      divider,
      cta
    });
  }
};
