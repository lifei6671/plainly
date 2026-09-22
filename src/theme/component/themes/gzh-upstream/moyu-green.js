/* eslint-disable */
import { applyComponentFlow } from './engine.js';
import {
  sec, p, sp, leaf, px, splitListItem, moveChildren, buildCtaCard, SANS, MONO
} from './shared.js';

const GREEN = '#059669';

function pill(doc, scale, label, color, bg) {
  return sp(doc,
    `display:inline-block;font-size:${px(13, scale)};font-weight:700;color:${color};background:${bg};padding:3px 10px;border-radius:999px;vertical-align:middle;`,
    sp(doc, `display:inline-block;width:6px;height:6px;background:${color};border-radius:50%;margin-right:5px;vertical-align:middle;`, leaf(doc)),
    doc.createTextNode(label));
}

function cover(h1, { scale, tag, footer, date, author }) {
  const doc = h1.ownerDocument;
  const bottomStrip = footer || author
    ? sec(doc, 'background:linear-gradient(135deg,#059669,#10B981);padding:12px 28px;display:flex;align-items:center;justify-content:space-between;gap:16px;',
        footer ? p(doc, 'font-size:12px;color:rgba(255,255,255,0.9);margin:0;font-weight:600;letter-spacing:0.5px;', doc.createTextNode(footer)) : null,
        author ? p(doc, 'font-size:11px;color:rgba(255,255,255,0.78);margin:0 0 0 auto;font-weight:600;letter-spacing:0.5px;white-space:nowrap;', doc.createTextNode(author)) : null)
    : null;

  h1.setAttribute('style', `font-size:${px(24, scale)};font-weight:700;color:#111827;margin:0 0 16px;line-height:1.3;letter-spacing:-1px;font-family:${SANS};`);

  return sec(doc,
    'margin:0 8px 32px;background:#fff;border:1.5px solid rgba(5,150,105,0.15);border-radius:20px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);',
    sec(doc, 'padding:32px 28px 28px;',
      sec(doc, 'display:flex;align-items:center;gap:8px;margin-bottom:28px;',
        sp(doc, 'width:6px;height:6px;background:#059669;border-radius:50%;', leaf(doc)),
        tag ? sp(doc, `font-size:${px(11, scale)};font-weight:700;letter-spacing:3px;color:#059669;`, doc.createTextNode(tag)) : null,
        sec(doc, 'flex:1;height:1px;overflow:hidden;background:linear-gradient(to right,rgba(5,150,105,0.12),transparent);', leaf(doc)),
        date ? sp(doc, `font-size:${px(10, scale)};color:#D1D5DB;font-weight:600;`, doc.createTextNode(date)) : null
      ),
      h1,
      sec(doc, 'width:48px;height:3px;background:linear-gradient(to right,#059669,#34D399);border-radius:2px;margin-bottom:12px;', leaf(doc))
    ),
    bottomStrip
  );
}

function chapter(h2, { index, isLast, number, tag, scale }) {
  const doc = h2.ownerDocument;
  h2.setAttribute('style', `margin:0 0 1px;font-size:${px(17, scale)};font-weight:700;color:#111827;letter-spacing:0.3px;line-height:1.5;font-family:${SANS};`);

  return sec(doc, `margin:${index === 0 ? '32px' : '48px'} 0 24px;padding:0 12px;`,
    sec(doc, 'display:flex;align-items:center;gap:16px;margin-bottom:24px;',
      sec(doc, 'text-align:center;flex-shrink:0;',
        p(doc, `margin:0;font-size:${px(28, scale)};font-weight:700;color:#059669;line-height:1;letter-spacing:-2px;`, doc.createTextNode(isLast ? '///' : number)),
        p(doc, `margin:0;font-size:${px(8, scale)};font-weight:700;color:#D1D5DB;letter-spacing:2px;`, doc.createTextNode(isLast ? 'LAST' : 'PART'))
      ),
      sp(doc, 'width:1px;height:36px;background:#E5E7EB;flex-shrink:0;', leaf(doc)),
      sec(doc, '',
        h2,
        tag ? p(doc, `margin:0;font-size:${px(11, scale)};font-weight:400;color:#9CA3AF;letter-spacing:1.5px;`, doc.createTextNode(tag)) : null
      )
    )
  );
}

function h3sub(h3, { scale }) {
  const doc = h3.ownerDocument;
  const marker = sp(doc, 'background:linear-gradient(180deg,transparent 65%,#FDE68A 65%);padding:0 4px;');
  moveChildren(h3, marker);
  h3.setAttribute('style', `margin:32px 0 16px;padding:0 12px;font-size:${px(15, scale)};font-weight:700;color:#111827;line-height:1.6;font-family:${SANS};`);
  h3.appendChild(marker);
  return h3;
}

function introQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const paras = Array.from(quote.children).filter((child) => child.tagName === 'P');
  const card = sec(doc, `background:#FFF;border:1px dashed #BBF7D0;border-radius:8px;padding:14px 16px;margin-bottom:24px;text-align:center;`);
  const wrapper = sec(doc, 'margin:0 12px;', card);

  if (paras.length > 1) {
    paras.slice(0, -1).forEach((para) => {
      const lead = p(doc, `font-size:${px(12, scale)};color:#9CA3AF;margin:0 0 6px;line-height:1.5;`);
      moveChildren(para, lead);
      card.appendChild(lead);
    });
  }
  const statement = p(doc, 'margin:0;line-height:1.6;');
  const inner = sp(doc, `font-size:${px(15, scale)};color:#059669;font-weight:bold;border-bottom:3px solid #FDE68A;padding-bottom:2px;`);
  const last = paras[paras.length - 1] || quote;
  moveChildren(last, inner);
  statement.appendChild(inner);
  card.appendChild(statement);
  return wrapper;
}

function blockQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:#F9FAFB;border:1px dashed #D1D5DB;border-radius:8px;padding:12px 16px;margin:0 12px 24px;text-align:justify;`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `font-size:${px(13, scale)};color:#374151;margin:${index === all.length - 1 ? '0' : '0 0 6px'};line-height:1.6;`);
  });
  return card;
}

function unorderedList(ul, { scale }) {
  const doc = ul.ownerDocument;
  return Array.from(ul.children).filter((child) => child.tagName === 'LI').map((item) => {
    const { label, description, descriptionNodes } = splitListItem(item);
    const block = sec(doc, 'margin:0 12px 14px;');
    const desc = p(doc, `font-size:${px(13, scale)};color:#4B5563;margin:0;line-height:1.7;text-align:justify;`);
    if (label) {
      desc.appendChild(pill(doc, scale, label, '#059669', 'rgba(5,150,105,0.08)'));
      desc.appendChild(doc.createTextNode(' '));
    }
    if (descriptionNodes) {
      descriptionNodes.forEach((node) => desc.appendChild(node));
    } else if (description) {
      desc.appendChild(doc.createTextNode(description));
    } else if (!label) {
      moveChildren(item, desc);
    } else {
      return block;
    }
    block.appendChild(desc);
    return block;
  });
}

function orderedList(ol, { scale }) {
  const doc = ol.ownerDocument;
  return Array.from(ol.children).filter((child) => child.tagName === 'LI').map((item, index) => {
    const row = sec(doc, 'display:flex;align-items:flex-start;gap:10px;margin:0 12px 12px;');
    const circle = sp(doc,
      `display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#059669;color:#fff;font-size:${px(11, scale)};font-weight:700;border-radius:50%;flex-shrink:0;margin-top:2px;`,
      doc.createTextNode(String(index + 1)));
    const content = p(doc, `font-size:${px(14, scale)};color:#374151;margin:0;line-height:1.9;flex:1;`);
    moveChildren(item, content);
    row.appendChild(circle);
    row.appendChild(content);
    return row;
  });
}

function divider(rule) {
  const doc = rule.ownerDocument;
  return sec(doc, 'padding:0 12px;',
    sec(doc, 'height:1px;background:#F3F4F6;margin:0;', leaf(doc)));
}

function toc(items, { scale, doc }) {
  const track = sec(doc, 'display:flex;align-items:stretch;gap:8px;overflow-x:auto;-webkit-overflow-scrolling:touch;padding-bottom:8px;');
  items.forEach((item, index) => {
    const active = index === 0;
    const cardStyle = active
      ? 'flex:0 0 120px;display:flex;flex-direction:column;background:linear-gradient(135deg,#059669,#10B981);border-radius:12px;padding:12px;'
      : 'flex:0 0 120px;display:flex;flex-direction:column;background:#fff;border:1px solid #E5E7EB;border-radius:12px;padding:12px;box-shadow:0 2px 6px rgba(0,0,0,0.04);';
    track.appendChild(sec(doc, cardStyle,
      p(doc, `font-size:${px(9, scale)};font-weight:700;color:${active ? 'rgba(255,255,255,0.7)' : '#9CA3AF'};letter-spacing:1px;margin:0 0 5px;`,
        doc.createTextNode(`PART ${index === items.length - 1 ? '///' : item.number}`)),
      p(doc, `font-size:${px(12, scale)};font-weight:700;color:${active ? '#fff' : '#111827'};margin:0${item.tag ? ' 0 3px' : ''};`, doc.createTextNode(item.title)),
      item.tag
        ? p(doc, `font-size:${px(10, scale)};color:${active ? 'rgba(255,255,255,0.7)' : '#9CA3AF'};margin:0;line-height:1.45;`, doc.createTextNode(item.tag))
        : null
    ));
  });
  return sec(doc, 'margin:0 12px 32px;',
    sec(doc, 'display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;',
      p(doc, `font-size:${px(10, scale)};color:#9CA3AF;margin:0;text-transform:uppercase;letter-spacing:2px;font-weight:600;`,
        doc.createTextNode(`📦 ${items.length} Parts + Conclusion`)),
      p(doc, `font-size:${px(10, scale)};color:#9CA3AF;margin:0;`, doc.createTextNode('👉 滑动'))
    ),
    track
  );
}

function cta({ scale, doc, displaySettings }) {
  return buildCtaCard(doc, scale, {
    card: 'background:radial-gradient(circle at center,#F9FAFB 0%,#FFFFFF 100%);border:1px solid #E5E7EB;border-radius:16px;padding:32px 20px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.03);margin:0 12px 24px;',
    box: 'background:#fff;border-radius:12px;box-shadow:0 2px 4px rgba(0,0,0,0.05);border:1px solid #F3F4F6;',
    accentBox: 'background:#ECFDF5;border-radius:12px;box-shadow:0 2px 4px rgba(5,150,105,0.15);border:1px solid #A7F3D0;',
    iconColor: '#4B5563',
    accentColor: '#059669',
    leadColor: '#111827',
    interaction: displaySettings,
    thirdLabel: '转发',
    footer: p(doc, 'font-size:10px;color:#9CA3AF;letter-spacing:1px;margin:0;', doc.createTextNode('THANKS FOR READING'))
  });
}

export const moyuGreenTheme = {
  name: '摸鱼绿',
  preserveQuoteColors: true,
  styles: {
    container: `width:100%;max-width:none;box-sizing:border-box;margin:0 auto;padding:16px 0 32px;background-color:#FFFFFF !important;color:#374151 !important;font-family:${SANS};line-height:1.75;letter-spacing:0.5px;overflow-wrap:anywhere;`,
    h1: `margin:0 0 28px;padding:0 12px;font-family:${SANS};font-size:24px;font-weight:700;line-height:1.3;color:#111827 !important;`,
    h2: `margin:48px 0 24px;padding:0 12px;font-family:${SANS};font-size:17px;font-weight:700;line-height:1.5;color:#111827 !important;`,
    h3: `margin:32px 0 16px;padding:0 12px;font-family:${SANS};font-size:15px;font-weight:700;line-height:1.6;color:#111827 !important;`,
    h4: `margin:24px 0 14px;padding:0 12px;font-size:15px;font-weight:700;line-height:1.6;color:#111827 !important;`,
    h5: `margin:20px 0 10px;padding:0 12px;font-size:14px;font-weight:700;color:#111827 !important;`,
    h6: `margin:18px 0 10px;padding:0 12px;font-size:13px;font-weight:700;color:#9CA3AF !important;`,
    p: 'margin:0 0 16px;padding:0 12px;font-size:14px;line-height:1.9;text-align:justify;color:#374151 !important;',
    strong: `font-weight:700;color:${GREEN} !important;`,
    em: 'font-style:italic;color:#4B5563 !important;',
    a: `color:${GREEN} !important;font-weight:600;text-decoration:underline;overflow-wrap:break-word;`,
    u: 'text-decoration:none;border-bottom:2px solid #A7F3D0;font-weight:600;',
    mark: 'background:linear-gradient(180deg,transparent 60%,#FDE68A 60%);color:#111827;font-weight:600;padding:0 2px;',
    s: 'color:#9CA3AF;text-decoration:line-through;',
    ul: 'margin:0 0 16px;padding:0 12px;',
    ol: 'margin:0 0 16px;padding:0 12px;',
    li: 'margin:8px 0;font-size:14px;line-height:1.9;color:#374151 !important;',
    'li p': 'margin:6px 0;',
    blockquote: 'margin:0 12px 24px;padding:14px 16px;background:#F9FAFB;border:1px dashed #D1D5DB;border-radius:8px;',
    'blockquote p': 'margin:0 0 6px;font-size:13px;color:#374151 !important;',
    code: `font-family:${MONO};font-size:13px;padding:2px 6px;border-radius:4px;background-color:#F3F4F6;color:#1F2937;font-weight:600;`,
    pre: `margin:20px 0;padding:16px;background-color:#F6F8FA;color:#1F2937;border:1px solid #E5E7EB;border-left:3px solid #059669;border-radius:8px;overflow-x:auto;line-height:1.7;`,
    hr: 'margin:24px 0;border:0;border-top:1px solid #F3F4F6;',
    img: 'display:block;max-width:100%;height:auto;margin:20px auto;border-radius:8px;border:1px solid #E5E7EB;',
    table: 'width:100%;border-collapse:collapse;font-size:13px;',
    th: 'padding:10px 12px;text-align:left;background-color:#059669;color:#FFFFFF;border-bottom:1px solid #E5E7EB;font-weight:700;',
    td: 'padding:10px 12px;border-bottom:1px solid #E5E7EB;color:#374151;line-height:1.7;',
    tr: 'border:0;',
    'tbody tr:nth-child(even)': 'background-color:#F9FAFB;'
  },
  transform(doc, ctx) {
    applyComponentFlow(doc, ctx, {
      cover,
      toc,
      tocMinChapters: 2,
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
