/* eslint-disable */
import { applyComponentFlow } from './engine.js';
import {
  sec, p, sp, leaf, px, moveChildren, buildCtaCard, SANS, MONO
} from './shared.js';

const INK = '#1e1f23';
const TITLE = '#23251d';
const BODY = '#4d4f46';
const BORDER = '#bfc1b7';
const CREAM = '#fdfdf8';
const OLIVE_BG = '#eeefe9';
const ORANGE = '#ed7b2f';

const FONT = `'IBM Plex Sans',${SANS}`;
const MONO_FONT = `ui-monospace,Menlo,Monaco,Consolas,${MONO}`;

function nbspLeaf(doc) {
  const holder = doc.createElement('span');
  holder.setAttribute('leaf', '');
  holder.appendChild(doc.createTextNode(' '));
  return holder;
}

function dot(doc, size, color) {
  return sp(doc, `width:${size}px;height:${size}px;background:${color};border-radius:50%;display:inline-block;overflow:hidden;vertical-align:middle;font-size:0;line-height:0;`,
    nbspLeaf(doc));
}

function cover(h1, { scale, tag, label, footer, footerRight, author, issue, aside, coverImage }) {
  const doc = h1.ownerDocument;
  const masthead = label || tag;
  const footerEnd = footerRight || author;
  const coverImageSrc = h1.getAttribute('data-cover-image-src');
  h1.setAttribute('style', `font-size:${px(24, scale)};font-weight:800;color:${TITLE};margin:0 0 10px;line-height:1.15;letter-spacing:-0.75px;font-family:${FONT};`);

  const coverArt = coverImageSrc ? doc.createElement('img') : null;
  if (coverArt) {
    coverArt.setAttribute('src', coverImageSrc);
    coverArt.setAttribute('alt', aside || '封面插画');
    coverArt.setAttribute('style', 'display:block;width:100%;height:100%;object-fit:cover;border:0;border-radius:4px;');
  }

  const card = sec(doc, `background:${CREAM};border:1px solid ${BORDER};border-radius:6px;overflow:hidden;font-family:${FONT};margin-bottom:24px;`,
    sec(doc, 'padding:28px 24px 22px;',
      masthead || issue ? sec(doc, 'display:flex;align-items:center;gap:8px;margin-bottom:22px;',
        masthead ? dot(doc, 8, INK) : null,
        masthead ? sp(doc, `font-size:${px(10, scale)};font-weight:700;letter-spacing:3px;color:#65675e;`, doc.createTextNode(masthead)) : null,
        sp(doc, `flex:1;height:1px;background:${BORDER};display:inline-block;overflow:hidden;vertical-align:middle;font-size:0;line-height:0;`, nbspLeaf(doc)),
        issue ? sp(doc, `font-size:${px(10, scale)};color:#9ea096;font-weight:500;font-variant-numeric:tabular-nums;`, doc.createTextNode(issue)) : null
      ) : null,
      sec(doc, 'display:flex;align-items:stretch;gap:18px;',
        sec(doc, 'flex:1;min-width:0;',
          h1,
          sec(doc, 'display:flex;align-items:center;gap:4px;margin-bottom:12px;',
            sp(doc, 'width:22px;height:3px;background:#1e1f23;border-radius:2px;display:inline-block;overflow:hidden;vertical-align:middle;font-size:0;line-height:0;', nbspLeaf(doc)),
            sp(doc, `width:8px;height:3px;background:${BORDER};border-radius:2px;display:inline-block;overflow:hidden;vertical-align:middle;font-size:0;line-height:0;`, nbspLeaf(doc))
          )
        ),
        coverArt ? sec(doc, `flex-shrink:0;width:112px;height:96px;overflow:hidden;background:${OLIVE_BG};border:1px dashed ${BORDER};border-radius:6px;padding:4px;`, coverArt) : null
      )
    ),
    footer || footerEnd ? sec(doc, `background:${INK};padding:11px 24px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;`,
      footer ? p(doc, `font-size:${px(12, scale)};color:rgba(255,255,255,0.92);margin:0;font-weight:600;`, doc.createTextNode(footer)) : null,
      footerEnd ? p(doc, `font-size:${px(11, scale)};color:rgba(255,255,255,0.7);margin:0 0 0 auto;font-weight:600;`, doc.createTextNode(footerEnd)) : null
    ) : null
  );
  return card;
}

function chapter(h2, { index, isLast, number, tag, scale }) {
  const doc = h2.ownerDocument;
  h2.setAttribute('style', `margin:0 0 1px;font-size:${px(17, scale)};font-weight:800;color:${TITLE};letter-spacing:0.2px;line-height:1.5;font-family:${FONT};`);

  return sec(doc, `margin:32px 0 24px;`,
    sec(doc, 'display:flex;align-items:center;gap:14px;',
      sec(doc, 'text-align:center;flex-shrink:0;',
        p(doc, `margin:0;font-size:${px(24, scale)};font-weight:800;color:${TITLE};line-height:1;letter-spacing:-2px;`, doc.createTextNode(isLast ? '///' : number)),
        p(doc, `margin:0;font-size:${px(8, scale)};font-weight:700;color:#9ea096;letter-spacing:2px;`, doc.createTextNode(isLast ? 'END' : 'PART'))
      ),
      sp(doc, `width:1px;height:36px;background:${BORDER};flex-shrink:0;display:inline-block;overflow:hidden;vertical-align:middle;font-size:0;line-height:0;`, nbspLeaf(doc)),
      sec(doc, '',
        h2,
        tag ? p(doc, `margin:0;font-size:${px(11, scale)};font-weight:600;color:#65675e;letter-spacing:1.2px;`, doc.createTextNode(tag)) : null
      )
    )
  );
}

function h3sub(h3, { scale }) {
  h3.setAttribute('style', `font-size:${px(18, scale)};font-weight:700;color:${TITLE};margin:0;padding:0 2px;display:block;width:fit-content;box-shadow:inset 0 -0.5em 0 rgba(245,78,0,0.18);line-height:1.5;font-family:${FONT};`);
  return h3;
}

function introQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:${CREAM};border:1px solid ${BORDER};border-radius:6px;overflow:hidden;font-family:${FONT};margin-bottom:24px;`,
    sec(doc, `padding:10px 16px;background:${INK};display:flex;align-items:center;justify-content:space-between;gap:10px;`,
      p(doc, `margin:0;font-size:${px(10, scale)};font-weight:800;letter-spacing:2px;color:#ffffff;`, doc.createTextNode('EDITOR’S NOTE')),
      sp(doc, `font-size:${px(10, scale)};color:rgba(255,255,255,0.65);`, doc.createTextNode('开篇'))
    ),
    sec(doc, `padding:16px 18px 18px;background:${OLIVE_BG};`));
  moveChildren(quote, card.lastElementChild);
  Array.from(card.lastElementChild.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `margin:0;font-size:${px(14, scale)};line-height:1.9;color:${BODY};text-align:justify;${index === all.length - 1 ? '' : 'margin-bottom:8px;'}`);
  });
  return card;
}

function blockQuote(quote, { scale }) {
  const doc = quote.ownerDocument;
  const card = sec(doc, `background:${CREAM};border-radius:6px;padding:16px 18px;border:1px solid ${BORDER};margin-bottom:24px;`);
  moveChildren(quote, card);
  Array.from(card.children).filter((child) => child.tagName === 'P').forEach((para, index, all) => {
    para.setAttribute('style', `font-size:${px(14, scale)};color:${BODY};margin:${index === all.length - 1 ? '0' : '0 0 8px'};line-height:1.8;text-align:justify;`);
  });
  return card;
}

function orderedList(ol, { scale, doc }) {
  return Array.from(ol.children).filter((child) => child.tagName === 'LI').map((item, index) => {
    const row = sec(doc, 'display:flex;align-items:baseline;gap:10px;margin-bottom:10px;');
    row.appendChild(sp(doc,
      `flex-shrink:0;font-size:${px(12, scale)};font-weight:700;color:${TITLE};background:#e5e7e0;padding:3px 10px;border-radius:999px;border:1px solid ${BORDER};`,
      doc.createTextNode(String(index + 1).padStart(2, '0'))));
    const content = p(doc, `font-size:${px(14, scale)};color:${BODY};margin:0;line-height:1.8;text-align:justify;flex:1;`);
    moveChildren(item, content);
    row.appendChild(content);
    return row;
  });
}

function divider(rule, { scale }) {
  const doc = rule.ownerDocument;
  return sec(doc, 'display:flex;justify-content:center;align-items:center;gap:8px;margin:24px 0;',
    sp(doc, `width:${px(6, scale)};height:${px(6, scale)};background:${INK};border-radius:50%;`, leaf(doc)),
    sp(doc, `width:${px(6, scale)};height:${px(6, scale)};background:${BORDER};border-radius:50%;`, leaf(doc)),
    sp(doc, `width:${px(6, scale)};height:${px(6, scale)};background:${ORANGE};border-radius:50%;`, leaf(doc))
  );
}

function cta({ scale, doc, displaySettings }) {
  return buildCtaCard(doc, scale, {
    card: `background:${CREAM};border:1px solid ${BORDER};border-radius:6px;padding:22px 16px;text-align:center;font-family:${FONT};margin-bottom:24px;`,
    box: `background:${OLIVE_BG};border-radius:6px;border:1px solid ${BORDER};`,
    accentBox: 'background:#d4c9b8;border-radius:6px;border:1px solid #b17816;',
    iconColor: BODY,
    accentColor: TITLE,
    leadColor: TITLE,
    interaction: displaySettings,
    thirdLabel: '收藏',
    thirdIcon: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
    footer: p(doc, `line-height:1.6;font-size:${px(10, scale)};color:#9ea096;letter-spacing:2px;margin:0;font-weight:500;`, doc.createTextNode('THANKS FOR READING'))
  });
}

export const oliveJournalTheme = {
  name: '橄榄手记',
  preserveQuoteColors: true,
  styles: {
    container: `max-width:677px;box-sizing:border-box;margin:0 auto;padding:8px;background-color:${CREAM} !important;color:${BODY} !important;font-family:${FONT};line-height:1.75;overflow-wrap:anywhere;`,
    h1: `margin:0 0 24px;padding:0 2px;font-family:${FONT};font-size:24px;font-weight:800;line-height:1.15;color:${TITLE} !important;letter-spacing:-0.75px;`,
    h2: `margin:24px 0 24px;padding:0;font-family:${FONT};font-size:17px;font-weight:800;line-height:1.5;color:${TITLE} !important;`,
    h3: `margin:24px 0 14px;padding:0 2px;width:fit-content;box-shadow:inset 0 -0.5em 0 rgba(245,78,0,0.18);font-family:${FONT};font-size:18px;font-weight:700;line-height:1.5;color:${TITLE} !important;`,
    h4: `margin:24px 0 12px;padding:0 2px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.5;color:${TITLE} !important;`,
    h5: `margin:20px 0 10px;padding:0 2px;font-family:${FONT};font-size:14px;font-weight:700;color:${TITLE} !important;`,
    h6: `margin:18px 0 10px;padding:0 2px;font-family:${FONT};font-size:13px;font-weight:600;color:#65675e !important;`,
    p: `margin:0 0 24px;font-size:14px;line-height:1.9;text-align:justify;color:${BODY} !important;font-family:${FONT};`,
    strong: `font-weight:700;color:${TITLE} !important;`,
    em: 'font-style:italic;color:#65675e !important;',
    a: `color:${TITLE} !important;text-decoration:none;border-bottom:2px solid ${ORANGE};overflow-wrap:break-word;`,
    u: `text-decoration:none;border-bottom:2px solid ${ORANGE};font-weight:600;color:${TITLE};`,
    mark: `background-color:${OLIVE_BG};padding:1px 5px;border-radius:4px;font-weight:600;color:${TITLE};border:1px solid ${BORDER};`,
    s: 'color:#9ea096;text-decoration:line-through;',
    ul: `margin:0 0 24px;padding-left:22px;line-height:1.8;list-style-position:outside;`,
    ol: 'margin:0 0 24px;padding-left:22px;',
    li: `margin-bottom:8px;font-size:15px;color:${BODY};list-style-type:disc;line-height:1.8;`,
    'ol li': `list-style-type:decimal;`,
    'li p': 'margin:6px 0;',
    blockquote: `margin:0 0 24px;padding:16px 18px;background-color:${CREAM};border:1px solid ${BORDER};border-radius:6px;`,
    'blockquote p': `margin:0 0 8px;font-size:14px;color:${BODY} !important;`,
    code: `font-family:${MONO_FONT};font-size:13px;padding:2px 6px;border-radius:4px;background-color:${OLIVE_BG};color:${TITLE};border:1px solid #b6b7af;`,
    pre: `margin:24px 0;padding:16px;background-color:#F6F8FA;color:#1F2937;border:1px solid ${BORDER};border-left:3px solid ${INK};border-radius:6px;overflow-x:auto;line-height:1.7;`,
    hr: `margin:24px 0;border:0;border-top:2px solid ${BORDER};`,
    img: `display:block;max-width:100%;height:auto;margin:24px auto;border:1px solid ${BORDER};border-radius:6px;`,
    table: 'width:100%;border-collapse:collapse;font-size:13px;',
    th: `padding:10px 12px;text-align:left;background-color:${OLIVE_BG};color:${TITLE};border-bottom:1px solid ${BORDER};font-weight:700;`,
    td: `padding:10px 12px;border-bottom:1px solid ${BORDER};color:${BODY};line-height:1.7;`,
    tr: 'border:0;',
    'tbody tr:nth-child(even)': `background-color:${OLIVE_BG};`
  },
  transform(doc, ctx) {
    applyComponentFlow(doc, ctx, {
      cover,
      chapter,
      h3sub,
      introQuote,
      quote: blockQuote,
      orderedList,
      divider,
      cta
    });
  }
};

