/* eslint-disable */
import { applyComponentFlow } from './engine.js';
import {
  sec, p, sp, leaf, px, splitListItem, moveChildren, buildCtaCard, SANS, MONO
} from './shared.js';

const RED = '#DC2626';

function pill(doc, scale, label) {
  return sp(doc,
    `display:inline-block;font-size:${px(14, scale)};font-weight:700;color:#991B1B;background:#FEE2E2;padding:3px 10px;border-radius:999px;vertical-align:middle;`,
    sp(doc, 'display:inline-block;width:6px;height:6px;background:#DC2626;border-radius:50%;margin-right:5px;vertical-align:middle;', leaf(doc)),
    doc.createTextNode(label));
}

function introQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const paras = Array.from(quote.children).filter((child) => child.tagName === 'P');
  let signature = null;
  if (paras.length > 1) {
    const lastText = (paras[paras.length - 1].textContent || '').trim();
    if (lastText.startsWith('——') && lastText.length <= 20) {
      signature = paras.pop().textContent.trim();
    }
  }

  const card = sec(doc, 'margin:10px 10px 32px;background:#ffffff;border-radius:12px;box-shadow:0 4px 24px -4px rgba(220,38,38,0.15);padding:28px 24px 22px;overflow:hidden;',
    p(doc, `font-size:${px(42, scale)};color:#DC2626;font-weight:900;margin:0;line-height:0.6;`, doc.createTextNode('“')));

  const content = paras.length > 0 ? paras : [quote];
  content.forEach((para) => {
    const line = p(doc, `font-size:${px(16, scale)};font-weight:800;color:#1C1917;margin:12px 0 8px;line-height:1.75;padding-left:4px;`);
    moveChildren(para, line);
    card.appendChild(line);
  });

  if (signature) {
    card.appendChild(p(doc, `text-align:right;font-size:${px(12, scale)};color:#9CA3AF;margin:8px 0 0;letter-spacing:1px;`, doc.createTextNode(signature)));
  }
  return card;
}

function toc(items, { scale, doc }) {
  const cards = items.slice(0, 3).map((item, index) => {
    const style = index === 2
      ? 'flex:1;background:#FEF2F2;border-radius:10px;padding:16px 12px;text-align:center;border:1px solid #FEE2E2;'
      : 'flex:1;background:#FEF2F2;border-radius:10px;padding:16px 12px;text-align:center;border:1px solid #FEE2E2;margin-right:8px;';
    return sec(doc, style,
      p(doc, `display:inline-block;background:#DC2626;color:#FFFFFF;font-size:${px(12, scale)};font-weight:800;padding:2px 10px;border-radius:4px;margin:0 0 8px;`, doc.createTextNode(item.number)),
      p(doc, `font-size:${px(13, scale)};font-weight:700;color:#1C1917;margin:0;`, doc.createTextNode(item.title)));
  });
  return sec(doc, 'padding:0 10px 32px;',
    p(doc, `font-size:${px(14, scale)};color:#9CA3AF;margin:0 0 14px;letter-spacing:1px;`, doc.createTextNode('📌 本文看点')),
    sec(doc, 'display:flex;justify-content:space-between;', cards));
}

function chapter(h2, { index, isLast, number, tag, scale }) {
  const doc = h2.ownerDocument;
  h2.setAttribute('style', `font-size:${px(18, scale)};font-weight:800;color:#1C1917;margin:0;letter-spacing:0.5px;line-height:1.4;font-family:${SANS};`);

  return sec(doc, `margin:${index === 0 ? '32px' : '48px'} 0 28px;padding:0 10px;`,
    sec(doc, 'display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;padding-bottom:14px;border-bottom:3px solid #DC2626;',
      sec(doc, 'display:flex;align-items:center;',
        sp(doc, `display:inline-block;background:#DC2626;color:#FFFFFF;font-size:${px(18, scale)};font-weight:900;padding:4px 14px;border-radius:6px;margin-right:14px;line-height:1.3;`,
          doc.createTextNode(isLast ? '∞' : number)),
        sec(doc, '',
          tag ? p(doc, `font-size:${px(10, scale)};color:#DC2626;font-weight:700;letter-spacing:3px;margin:0 0 2px;text-transform:uppercase;`, doc.createTextNode(tag)) : null,
          h2
        )
      )
    )
  );
}

function h3sub(h3, { scale }) {
  h3.setAttribute('style', `margin:28px 0 14px;padding:0 10px 0 13px;border-left:3px solid #DC2626;font-size:${px(15, scale)};font-weight:800;color:#1C1917;line-height:1.4;font-family:${SANS};`);
  return h3;
}

function blockQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:#FEF2F2;border-radius:0 10px 10px 0;border-left:4px solid #DC2626;padding:18px 22px;margin:0 10px 24px;`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `font-size:${px(16, scale)};font-weight:800;color:#991B1B;margin:${index === all.length - 1 ? '0' : '0 0 8px'};line-height:1.8;`);
  });
  return card;
}

function unorderedList(ul, { scale }) {
  const doc = ul.ownerDocument;
  return Array.from(ul.children).filter((child) => child.tagName === 'LI').map((item) => {
    const { label, description, descriptionNodes } = splitListItem(item);
    const block = sec(doc, 'margin:0 10px 14px;');
    const desc = p(doc, `font-size:${px(14, scale)};color:#4B5563;margin:0;line-height:1.7;text-align:justify;`);
    if (label) {
      desc.appendChild(pill(doc, scale, label));
      desc.appendChild(doc.createTextNode(' '));
    }
    if (descriptionNodes) descriptionNodes.forEach((node) => desc.appendChild(node));
    else if (description) desc.appendChild(doc.createTextNode(description));
    else if (!label) moveChildren(item, desc);
    else return block;
    block.appendChild(desc);
    return block;
  });
}

function orderedList(ol, { scale }) {
  const doc = ol.ownerDocument;
  return Array.from(ol.children).filter((child) => child.tagName === 'LI').map((item, index) => {
    const row = sec(doc, 'display:flex;align-items:flex-start;gap:10px;margin:0 10px 12px;');
    row.appendChild(sp(doc,
      `display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;background:#DC2626;color:#fff;font-size:${px(12, scale)};font-weight:700;border-radius:50%;flex-shrink:0;margin-top:2px;`,
      doc.createTextNode(String(index + 1))));
    const content = p(doc, `font-size:${px(15, scale)};color:#374151;margin:0;line-height:1.8;flex:1;`);
    moveChildren(item, content);
    row.appendChild(content);
    return row;
  });
}

function divider(rule, { isLast, scale }) {
  const doc = rule.ownerDocument;
  if (!isLast) {
    return sec(doc, 'padding:0 10px;',
      sec(doc, 'height:1px;background:linear-gradient(to right,transparent,#FCA5A5,#DC2626,#FCA5A5,transparent);margin:0;', leaf(doc)));
  }
  return sec(doc, 'padding:0 10px;',
    sec(doc, 'text-align:center;margin:0 0 32px;',
      sec(doc, 'display:flex;align-items:center;justify-content:center;',
        sp(doc, 'height:2px;width:60px;background:linear-gradient(to right,transparent,#DC2626);margin-right:12px;', leaf(doc)),
        sp(doc, `font-size:${px(11, scale)};color:#DC2626;letter-spacing:3px;font-weight:700;`, doc.createTextNode('END')),
        sp(doc, 'height:2px;width:60px;background:linear-gradient(to left,transparent,#DC2626);margin-left:12px;', leaf(doc))
      )
    )
  );
}

function cta({ scale, doc, displaySettings }) {
  return buildCtaCard(doc, scale, {
    card: 'background:#ffffff;border-radius:12px;box-shadow:0 4px 24px -4px rgba(220,38,38,0.15);padding:32px 20px;text-align:center;margin:0 10px 24px;',
    box: 'background:#fff;border-radius:10px;box-shadow:0 2px 4px rgba(0,0,0,0.05);border:1px solid #FEE2E2;',
    accentBox: 'background:#FEF2F2;border-radius:10px;box-shadow:0 2px 4px rgba(220,38,38,0.12);border:1px solid #FECACA;',
    iconColor: '#4B5563',
    accentColor: '#DC2626',
    leadColor: '#1C1917',
    interaction: displaySettings,
    thirdLabel: '转发',
    footer: p(doc, 'font-size:10px;color:#9CA3AF;letter-spacing:1px;margin:0;', doc.createTextNode('THANKS FOR READING'))
  });
}

export const redWhiteTheme = {
  name: '红白色系',
  preserveQuoteColors: true,
  styles: {
    container: `width:100%;max-width:none;box-sizing:border-box;margin:0 auto;padding:8px 0 32px;background-color:#FFFFFF !important;color:#374151 !important;font-family:${SANS};line-height:1.75;letter-spacing:0.5px;overflow-wrap:anywhere;`,
    h1: `margin:10px 10px 28px;padding:0;font-family:${SANS};font-size:22px;font-weight:900;line-height:1.4;color:#1C1917 !important;letter-spacing:1px;`,
    h2: `margin:48px 0 28px;padding:0 10px;font-family:${SANS};font-size:18px;font-weight:800;line-height:1.4;color:#1C1917 !important;`,
    h3: `margin:28px 0 14px;padding:0 10px 0 13px;border-left:3px solid #DC2626;font-family:${SANS};font-size:15px;font-weight:800;line-height:1.4;color:#1C1917 !important;`,
    h4: `margin:24px 0 12px;padding:0 10px;font-size:15px;font-weight:800;line-height:1.5;color:#1C1917 !important;`,
    h5: `margin:20px 0 10px;padding:0 10px;font-size:14px;font-weight:700;color:#1C1917 !important;`,
    h6: `margin:18px 0 10px;padding:0 10px;font-size:13px;font-weight:700;color:#9CA3AF !important;`,
    p: 'margin:0 0 20px;padding:0 10px;font-size:15px;line-height:1.8;text-align:justify;color:#374151 !important;',
    strong: `font-weight:700;color:${RED} !important;`,
    em: 'font-style:italic;color:#4B5563 !important;',
    a: `color:${RED} !important;font-weight:600;text-decoration:underline;overflow-wrap:break-word;`,
    u: 'text-decoration:none;border-bottom:2px solid #FECACA;font-weight:600;',
    mark: 'background-color:#FEE2E2;color:#991B1B;padding:2px 6px;border-radius:3px;font-weight:700;',
    s: 'color:#9CA3AF;text-decoration:line-through;',
    ul: 'margin:0 0 16px;padding:0 10px;',
    ol: 'margin:0 0 16px;padding:0 10px;',
    li: 'margin:8px 0;font-size:15px;line-height:1.8;color:#374151 !important;',
    'li p': 'margin:6px 0;',
    blockquote: 'margin:0 10px 24px;padding:18px 22px;background:#FEF2F2;border-left:4px solid #DC2626;border-radius:0 10px 10px 0;',
    'blockquote p': 'margin:0 0 8px;font-size:16px;font-weight:800;color:#991B1B !important;',
    code: `font-family:${MONO};font-size:14px;padding:2px 6px;border-radius:4px;background-color:#F3F4F6;color:#1F2937;font-weight:600;`,
    pre: `margin:20px 0;padding:16px;background-color:#F6F8FA;color:#1F2937;border:1px solid #E5E7EB;border-left:3px solid #DC2626;border-radius:8px;overflow-x:auto;line-height:1.7;`,
    hr: 'margin:24px 0;border:0;border-top:1px solid #FEE2E2;',
    img: 'display:block;max-width:100%;height:auto;margin:20px auto;border-radius:8px;border:1px solid #E5E7EB;box-shadow:0 2px 8px rgba(0,0,0,0.04);',
    table: 'width:100%;border-collapse:collapse;font-size:14px;',
    th: 'padding:10px 12px;text-align:left;background-color:#DC2626;color:#FFFFFF;border-bottom:1px solid #FEE2E2;font-weight:700;',
    td: 'padding:10px 12px;border-bottom:1px solid #FEE2E2;color:#374151;line-height:1.7;',
    tr: 'border:0;',
    'tbody tr:nth-child(even)': 'background-color:#FEF2F2;'
  },
  transform(doc, ctx) {
    applyComponentFlow(doc, ctx, {
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
