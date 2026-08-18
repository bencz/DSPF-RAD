// Linked-subfile band (T-05/T-07/T-08): React counterpart of
// drawLinkedSubfile in src/canvas/drawSubfile.js.  Renders the linked
// SFL template repeated SFLPAG times below the SFLCTL chrome — backdrop
// band, per-repeat DspfItems, optional SFLEND(*SCRBAR) scrollbar — or a
// single SFLMSGRCD status line when the control record is a message
// subfile (the canvas early-returns on that branch too).
//
// Positioning: the returned fragment must be mounted as direct children
// of the CSS grid (.dspf-grid) so the repeated DspfItems participate in
// grid layout.  The absolutely-positioned band / scrollbar / message-line
// divs therefore need the grid container (or an equivalent wrapper) to be
// their containing block (position: relative) — mirroring how the canvas
// paints them in grid-local coordinates.
//
// The canvas paints the subfile BEFORE the active SFLCTL record, so the
// parent renders the SFLCTL items afterward (they land on top on overlap).

import { readNumericKeyword } from '@dspf/canvas/keywordReaders.js';
import { effectiveLength } from '@dspf/canvas/metrics.js';
import { itemSignature } from '@dspf/canvas/styleResolver.js';

import { DspfItem } from './DspfItem.jsx';

// paintBackdrop in drawSubfile.js hardcodes this fill; the stronger
// RECORD_BG.SFL (0.10 alpha) is the per-item tint DspfItem applies on
// top of each repeated cell.
const SFL_BAND_BG = 'rgba(80, 150, 220, 0.06)';

const MSG_LINE_BG = 'rgba(220, 180, 80, 0.18)';
const MSG_LINE_FG = '#cca844';

const SB_TRACK_BG = '#0e1a0e';
const SB_TRACK_BORDER = '#2a4a2a';
const SB_GLYPH = '#6f6';
const SB_THUMB_BG = 'rgba(102, 255, 102, 0.25)';

const cellH = (cw) => cw * 2;

// Prepare the SFL template's effective lengths once (drawSubfile's
// prepareTemplateWidths) and carry them into every shifted clone so
// REFFLD inferred widths stay identical to the canvas copies (which
// spread the precomputed _effectiveLength through the row shift).
// Unlike the canvas, the templates themselves are left untouched.
function templateEffectiveLengths (sfl, doc) {
    const map = new Map();
    for (const tpl of sfl.items) {
        if (tpl.kind === 'field') {
            map.set(tpl, effectiveLength(tpl, sfl.items, doc.cols));
        }
    }
    return map;
}

// SFLMSGRCD(row) — a single full-width status line replacing the band
// (drawMessageLine in drawSubfile.js).
function subfileMessageLine (msgRcd, doc, cw, ch) {
    const msgRow = parseInt(msgRcd.args?.[0], 10);
    if (!Number.isFinite(msgRow)) return null;

    return (
        <div className="dspf-sfl-msgline"
             style={{
                 position: 'absolute',
                 top: (msgRow - 1) * ch,
                 left: 0,
                 width: doc.cols * cw,
                 height: ch,
                 backgroundColor: MSG_LINE_BG,
                 border: '1px solid ' + MSG_LINE_FG,
                 boxSizing: 'border-box',
                 color: MSG_LINE_FG,
                 fontFamily: 'monospace',
                 fontSize: Math.max(9, cw * 1.7 * 0.7),
                 lineHeight: ch + 'px',
                 paddingLeft: 4,
                 whiteSpace: 'pre',
                 overflow: 'hidden',
                 pointerEvents: 'none',
             }}>
            ◆ message line (SFLMSGRCD)
        </div>
    );
}

// ENPTUI scroll bar on the right edge of the subfile band (drawScrollBar
// in drawSubfile.js): up arrow + track + thumb + down arrow.  No runtime
// state — thumb at the top by default.
function subfileScrollbar (startRow, rowCount, gridCols, cw, ch) {
    const w = cw;
    const h = rowCount * ch;
    const arrowFont = Math.max(8, cw * 1.7 * 0.7);
    const thumbH = Math.max(ch * 1.5, h / 4);
    const thumbTop = ch + (h - ch * 2 - thumbH) * 0.25;

    const arrowStyle = {
        position: 'absolute',
        left: 0,
        width: '100%',
        height: ch,
        color: SB_GLYPH,
        fontFamily: '"SF Mono", Menlo, monospace',
        fontSize: arrowFont,
        lineHeight: ch + 'px',
        textAlign: 'center',
    };

    return (
        <div className="dspf-sfl-scrollbar"
             style={{
                 position: 'absolute',
                 top: (startRow - 1) * ch,
                 left: (gridCols - 1) * cw,
                 width: w,
                 height: h,
                 backgroundColor: SB_TRACK_BG,
                 border: '1px solid ' + SB_TRACK_BORDER,
                 boxSizing: 'border-box',
                 pointerEvents: 'none',
             }}>
            <div className="dspf-sfl-sb-up" style={{ ...arrowStyle, top: 0 }}>▲</div>
            <div className="dspf-sfl-sb-thumb"
                 style={{
                     position: 'absolute',
                     top: thumbTop,
                     left: 2,
                     width: w - 4,
                     height: thumbH,
                     backgroundColor: SB_THUMB_BG,
                     border: '1px solid ' + SB_GLYPH,
                     boxSizing: 'border-box',
                 }} />
            <div className="dspf-sfl-sb-down" style={{ ...arrowStyle, top: h - ch }}>▼</div>
        </div>
    );
}

export function SubfileBand ({ sfl, sflctl, doc, bus, onSelect, cellW }) {
    const cw = cellW ?? 10;
    const ch = cellH(cw);
    const kws = sflctl.keywords ?? [];

    // Message-subfile branch: SFLMSGRCD(row) declares a single status
    // line and replaces the whole band.
    const msgRcd = kws.find((kw) => kw.name === 'SFLMSGRCD');
    if (msgRcd) return subfileMessageLine(msgRcd, doc, cw, ch);

    // Linked SFL: the SFLCTL keyword args[0] names the record.  The
    // `sfl` prop is the already-resolved record; fall back to the same
    // lookup the canvas performs.
    const linkKw = kws.find((kw) => kw.name === 'SFLCTL');
    const target = sfl
        ?? (linkKw && linkKw.args.length
            ? (doc.records ?? []).find((r) => r.name === linkKw.args[0] && r.type === 'SFL')
            : null);
    if (!target || !target.items.length) return null;

    const sflpag = readNumericKeyword(sflctl, 'SFLPAG') ?? 0;
    const sflsiz = readNumericKeyword(sflctl, 'SFLSIZ') ?? sflpag;
    let rows = sflpag > 0 ? sflpag : (sflsiz > 0 ? sflsiz : 1);

    const anchorRow = Math.min(
        ...target.items
              .filter((it) => !(it.kind === 'field' && it.usage === 'H'))
              .map((it) => it.row));
    if (!Number.isFinite(anchorRow)) return null;

    // CLAMP: never exceed the grid — SFLSIZ(9999) fixtures must not
    // explode the DOM (the canvas paints beyond the grid and relies on
    // canvas clipping instead).
    rows = Math.min(rows, Math.max(0, doc.rows - anchorRow + 1));
    if (rows <= 0) return null;

    const eff = templateEffectiveLengths(target, doc);
    const selectedId = bus?.current ?? null;

    const sflend = kws.find((k) => k.name === 'SFLEND');
    const hasScrbar = sflend && (sflend.args ?? []).some((a) =>
        String(a).toUpperCase() === '*SCRBAR');

    return (
        <>
            <div className="dspf-sfl-band"
                 style={{
                     position: 'absolute',
                     top: (anchorRow - 1) * ch,
                     left: 0,
                     width: doc.cols * cw,
                     height: rows * ch,
                     backgroundColor: SFL_BAND_BG,
                     pointerEvents: 'none',
                 }} />
            {Array.from({ length: rows }, (_, r) =>
                target.items
                    .filter((tpl) => !(tpl.kind === 'field' && tpl.usage === 'H'))
                    .filter((tpl) => tpl.row + r <= doc.rows)
                    .map((tpl) => (
                        <DspfItem
                            key={`${itemSignature(tpl)}#${r}`}
                            item={{ ...tpl, row: tpl.row + r, _effectiveLength: eff.get(tpl) }}
                            record={target}
                            doc={doc}
                            selected={tpl.id === selectedId}
                            onSelect={onSelect} />
                    ))
            )}
            {hasScrbar && subfileScrollbar(anchorRow, rows, doc.cols, cw, ch)}
        </>
    );
}
