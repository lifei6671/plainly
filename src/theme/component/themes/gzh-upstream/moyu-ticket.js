/* eslint-disable */
import { applyComponentFlow } from './engine.js';
import {
  sec, p, sp, leaf, px, splitListItem, moveChildren, buildCtaCard, SANS, MONO
} from './shared.js';

const GREEN = '#059669';
const INK = '#1a1a1a';
const CREAM = '#fffef8';
const TEAR = '#A7F3D0';

function ticketIssue(doc, issue, scale) {
  const normalized = issue.trim();
  const match = normalized.match(/^(?:NO\.?\s*|第\s*)?(\d+)\s*期?$/i);
  const prefix = match ? 'NO.' : '';
  const number = match ? match[1].padStart(3, '0') : normalized;

  return sec(doc, 'width:100%;min-width:0;text-align:center;font-family:Arial,\'PingFang SC\',sans-serif;line-height:1.5;',
    prefix ? sec(doc, `margin:0 0 5px;font-size:${px(8, scale)};font-weight:700;letter-spacing:1px;color:#6B7280;`, doc.createTextNode(prefix)) : null,
    sec(doc, `font-size:${px(match ? 18 : 11, scale)};font-weight:500;letter-spacing:0.25px;color:${GREEN};overflow-wrap:anywhere;`, doc.createTextNode(number))
  );
}

function cover(h1, { scale, tag, label, subtitle, summary, footer, footerRight, author, authorBio, stars, issue, aside, grade, tags }) {
  const doc = h1.ownerDocument;
  const masthead = label || tag;
  const footerEnd = footerRight;
  const tagList = tags.split(/[,，]/).map((item) => item.trim()).filter(Boolean);
  const starCount = /^[1-5]$/.test(stars) ? Number(stars) : 0;
  const hasDetails = author || authorBio || summary || tagList.length;
  const hasStub = issue || aside || grade;
  h1.setAttribute('style', `font-size:${px(24, scale)};font-weight:900;color:${INK};letter-spacing:0.5px;margin:0 0 4px;line-height:1.3;font-family:${SANS};`);

  const main = sec(doc, 'display:flex;',
    sec(doc, `flex:1;min-width:0;padding:24px 20px;${hasStub ? `border-right:2px dashed ${TEAR};` : ''}`,
      h1,
      subtitle ? sec(doc, `font-size:${px(14, scale)};color:#666;letter-spacing:1px;line-height:1.75;`, doc.createTextNode(subtitle)) : null,
      hasDetails ? sec(doc, `height:0;line-height:0;font-size:0;border-top:1px dashed ${TEAR};margin:20px 0;`) : null,
      author || authorBio ? sec(doc, summary || tagList.length ? 'margin-bottom:16px;' : '',
        author ? sec(doc, `font-size:${px(15, scale)};line-height:1.6;color:${INK};font-weight:700;`, doc.createTextNode(author)) : null,
        authorBio ? sec(doc, `font-size:${px(12, scale)};line-height:1.75;color:#707070;${author ? 'margin-top:3px;' : ''}`, doc.createTextNode(authorBio)) : null
      ) : null,
      summary ? sec(doc, `font-size:${px(13, scale)};color:#555;line-height:1.8;padding:12px;background:#F0FDF4;border:1px solid ${TEAR};`, doc.createTextNode(summary)) : null,
      tagList.length ? sec(doc, 'display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;', tagList.map((item) => sp(doc, `font-size:${px(10, scale)};color:${GREEN};border:1px solid ${GREEN};padding:4px 10px;`, doc.createTextNode(`#${item.replace(/^#/, '')}`)))) : null
    ),
    hasStub ? sec(doc, `box-sizing:border-box;flex:0 0 ${px(56, scale)};width:${px(56, scale)};min-width:0;padding:14px 4px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;gap:20px;background:#F0FDF4;`,
      issue ? ticketIssue(doc, issue, scale) : null,
      aside ? sec(doc, 'writing-mode:vertical-rl;font-size:9px;color:#888;letter-spacing:2px;', doc.createTextNode(aside)) : null,
      grade ? sec(doc, 'text-align:center;',
        sec(doc, `font-size:${px(7, scale)};letter-spacing:1px;color:#6B7280;`, doc.createTextNode('GRADE')),
        sec(doc, `font-size:${px(14, scale)};color:${GREEN};overflow-wrap:anywhere;`, doc.createTextNode(grade))) : null
    ) : null
  );

  return sec(doc, `background:${CREAM};border:2px solid ${INK};box-shadow:4px 4px 0 ${INK};margin-bottom:32px;`,
    masthead || starCount ? sec(doc, `background:${GREEN};padding:12px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;`,
      masthead ? sec(doc, `min-width:0;overflow-wrap:anywhere;color:${CREAM};font-size:${px(11, scale)};letter-spacing:4px;font-weight:600;`, doc.createTextNode(masthead)) : null,
      starCount ? sec(doc, `flex-shrink:0;margin-left:auto;color:${CREAM};font-size:${px(13, scale)};line-height:1;letter-spacing:1px;`, doc.createTextNode('★'.repeat(starCount))) : null
    ) : null,
    main,
    sec(doc, 'height:18px;margin:0 8px;display:flex;align-items:center;',
      sec(doc, `flex:1;height:0;line-height:0;font-size:0;border-top:2px dashed ${TEAR};`),
      sp(doc, `display:block;padding:0 8px;font-size:12px;line-height:18px;color:${TEAR};`, doc.createTextNode('✂')),
      sec(doc, `flex:1;height:0;line-height:0;font-size:0;border-top:2px dashed ${TEAR};`)
    ),
    footer || footerEnd ? sec(doc, 'padding:10px 20px;display:flex;justify-content:space-between;align-items:center;gap:12px;',
      footer ? sec(doc, `font-size:${px(10, scale)};color:#999;letter-spacing:1px;`, doc.createTextNode(footer)) : null,
      footerEnd ? sec(doc, `font-size:${px(10, scale)};color:#999;letter-spacing:1px;margin-left:auto;text-align:right;`, doc.createTextNode(footerEnd)) : null
    ) : null
  );
}

function chapter(h2, { index, number, tag, scale }) {
  const doc = h2.ownerDocument;
  h2.setAttribute('style', `font-size:${px(18, scale)};font-weight:800;color:${INK};letter-spacing:1px;margin:0;line-height:1.4;font-family:${SANS};`);

  return sec(doc, `margin-top:${index === 0 ? 32 : 40}px;margin-bottom:32px;padding:0 20px;`,
    sec(doc, `display:flex;align-items:center;gap:12px;margin-bottom:24px;padding-bottom:12px;border-bottom:2px solid ${INK};`,
      sec(doc, `background:${GREEN};color:#fff;font-size:${px(12, scale)};font-weight:800;padding:6px 12px;letter-spacing:2px;`, doc.createTextNode(number)),
      h2,
      tag ? sec(doc, `font-size:${px(12, scale)};color:#888;`, doc.createTextNode(`/ ${tag}`)) : null
    )
  );
}

function h3sub(h3, { scale }) {
  const doc = h3.ownerDocument;
  h3.setAttribute('style', `font-size:${px(15, scale)};font-weight:700;color:${INK};margin:0;line-height:1.5;font-family:${SANS};`);
  return sec(doc, 'margin-bottom:16px;',
    sec(doc, 'display:flex;align-items:center;gap:8px;margin-bottom:16px;',
      sec(doc, `width:4px;height:16px;background:${GREEN};`, leaf(doc)),
      h3
    )
  );
}

function introQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:${CREAM};border:2px solid ${INK};box-shadow:3px 3px 0 ${INK};padding:20px;margin:0 20px 32px;`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `font-size:${index === all.length - 1 ? px(14, scale) : px(15, scale)};color:${INK};font-weight:700;line-height:1.8;margin:${index === all.length - 1 ? '0' : '0 0 12px'};text-align:${index === all.length - 1 ? 'justify' : 'center'};`);
  });
  return card;
}

function blockQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:#F0FDF4;border-left:4px solid ${GREEN};padding:14px 16px;margin:0 20px 32px;`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `font-size:${px(14, scale)};color:${INK};font-weight:600;line-height:1.7;margin:${index === all.length - 1 ? '0' : '0 0 6px'};`);
  });
  return card;
}

function featureCard(doc, scale, markerColumn, content) {
  return sec(doc, `background:${CREAM};border:1px solid #eee;margin-bottom:12px;`,
    sec(doc, 'display:flex;align-items:stretch;',
      markerColumn,
      sec(doc, `flex:1;padding:12px 16px;font-size:${px(13, scale)};color:#555;line-height:1.7;border-left:1px dashed ${TEAR};`, content)
    )
  );
}

function appendListContent(doc, item, content) {
  const { label, description, descriptionNodes } = splitListItem(item);
  if (label) content.appendChild(sp(doc, `font-weight:600;color:${INK};`, doc.createTextNode(label)));
  if (descriptionNodes) {
    content.appendChild(doc.createTextNode('：'));
    descriptionNodes.forEach((node) => content.appendChild(node));
  } else if (description) {
    content.appendChild(doc.createTextNode(`：${description}`));
  } else {
    moveChildren(item, content);
  }
}

function unorderedList(ul, { scale, doc }) {
  return Array.from(ul.children).filter((child) => child.tagName === 'LI').map((item) => {
    const content = sec(doc, '');
    appendListContent(doc, item, content);
    const marker = sec(doc, `width:36px;background:${GREEN};display:flex;align-items:center;justify-content:center;`,
      sp(doc, `width:8px;height:8px;background:#fff;`, leaf(doc)));
    return featureCard(doc, scale, marker, content);
  });
}

function orderedList(ol, { scale, doc }) {
  return Array.from(ol.children).filter((child) => child.tagName === 'LI').map((item, index) => {
    const content = sec(doc, '');
    appendListContent(doc, item, content);
    const marker = sec(doc, `width:36px;background:${GREEN};display:flex;align-items:center;justify-content:center;color:#fff;font-size:${px(12, scale)};font-weight:800;`,
      doc.createTextNode(String(index + 1)));
    return featureCard(doc, scale, marker, content);
  });
}

function divider(rule, { isLast, scale }) {
  const doc = rule.ownerDocument;
  if (!isLast) {
    return sec(doc, `margin:32px 20px;border-top:2px dashed ${TEAR};`, leaf(doc));
  }
  return p(doc, `text-align:center;color:#D1D5DB;font-size:${px(14, scale)};margin:24px 0 0;`, doc.createTextNode('/'));
}

function cta({ scale, doc, displaySettings }) {
  const card = buildCtaCard(doc, scale, {
    card: `background:${CREAM};border:2px solid ${INK};box-shadow:4px 4px 0 ${INK};padding:24px 20px;text-align:center;margin:0 20px 32px;`,
    box: `background:#fff;border:1px solid ${INK};`,
    accentBox: `background:#F0FDF4;border:2px solid ${GREEN};`,
    iconColor: '#555',
    accentColor: GREEN,
    leadColor: INK,
    interaction: displaySettings,
    thirdLabel: '星标',
    thirdIcon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>'
  });
  const footer = card.lastElementChild;
  if (footer) card.removeChild(footer);
  card.appendChild(sec(doc, 'border-top:1px dashed #ccc;padding-top:12px;',
    p(doc, `font-size:${px(10, scale)};color:#999;letter-spacing:2px;margin:0;`, doc.createTextNode('THANKS FOR READING ✂'))));
  return card;
}

export const moyuTicketTheme = {
  name: '摸鱼票据风',
  preserveQuoteColors: true,
  styles: {
    container: `width:100%;max-width:none;box-sizing:border-box;margin:0 auto;padding:16px 0 32px;background-color:#FFFFFF !important;color:#555 !important;font-family:${SANS};line-height:1.75;letter-spacing:0.5px;overflow-wrap:anywhere;`,
    h1: `margin:0 0 28px;padding:0 20px;font-family:${SANS};font-size:24px;font-weight:900;line-height:1.3;color:${INK} !important;`,
    h2: `margin:0 0 32px;padding:0 20px;font-family:${SANS};font-size:18px;font-weight:800;line-height:1.4;color:${INK} !important;`,
    h3: `margin:16px 0 16px;padding:0 20px;font-family:${SANS};font-size:15px;font-weight:700;line-height:1.5;color:${INK} !important;`,
    h4: `margin:24px 0 12px;padding:0 20px;font-size:15px;font-weight:700;line-height:1.5;color:${INK} !important;`,
    h5: `margin:20px 0 10px;padding:0 20px;font-size:14px;font-weight:700;color:${INK} !important;`,
    h6: `margin:18px 0 10px;padding:0 20px;font-size:13px;font-weight:700;color:#888 !important;`,
    p: 'margin:0 0 16px;padding:0 20px;font-size:14px;line-height:1.9;text-align:justify;color:#555 !important;',
    strong: `font-weight:700;color:${GREEN} !important;`,
    em: 'font-style:italic;color:#666 !important;',
    a: `color:${GREEN} !important;font-weight:700;text-decoration:underline;overflow-wrap:break-word;`,
    u: 'text-decoration:none;border-bottom:2px solid #A7F3D0;font-weight:600;',
    mark: 'background:linear-gradient(120deg,#A7F3D0 0%,rgba(167,243,208,0) 100%);color:#111;padding:0 4px;font-weight:600;',
    s: 'color:#999;text-decoration:line-through;',
    ul: 'margin:0 0 16px;padding:0 20px;',
    ol: 'margin:0 0 16px;padding:0 20px;',
    li: 'margin:8px 0;font-size:14px;line-height:1.9;color:#555 !important;',
    'li p': 'margin:6px 0;',
    blockquote: `margin:0 20px 32px;padding:14px 16px;background:#F0FDF4;border-left:4px solid ${GREEN};`,
    'blockquote p': `margin:0 0 6px;font-size:14px;font-weight:600;color:${INK} !important;`,
    code: `font-family:${MONO};font-size:13px;padding:2px 6px;border-radius:4px;background-color:#F3F4F6;color:#1F2937;font-weight:600;`,
    pre: `margin:20px 0;padding:16px;background-color:#F6F8FA;color:#1F2937;border:1px solid #E5E7EB;border-left:3px solid ${GREEN};border-radius:4px;overflow-x:auto;line-height:1.7;`,
    hr: `margin:32px 20px;border:0;border-top:2px dashed ${TEAR};`,
    img: `display:block;max-width:100%;height:auto;margin:20px auto;background:${CREAM};border:1px solid #eee;border-radius:0;`,
    table: 'width:100%;border-collapse:collapse;font-size:13px;',
    th: `padding:10px 12px;text-align:left;background-color:${GREEN};color:#FFFFFF;border-bottom:2px solid ${INK};font-weight:800;`,
    td: `padding:10px 12px;border-bottom:1px solid #eee;color:#555;line-height:1.7;`,
    tr: 'border:0;'
  },
  transform(doc, ctx) {
    applyComponentFlow(doc, ctx, {
      cover,
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
