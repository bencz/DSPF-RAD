// 右側 React 預覽（T-03 起，T-07/T-08/T-09 擴充）：
// - 訂閱 doc.emit：任何編輯即時重繪（useSyncExternalStore）。
// - 儲存格數學與 canvas 共用：cellH = 2 × cellW，fontSize = 1.7 × cellW。
// - 背景格點與直欄線用 2D pattern，不建立每格 div。
// - React key 用內容簽名（D-10）。
// - overlay：非作用中記錄整層 0.30（OVERLAY_ALPHA）在作用中之下。
// - SFLCTL：連動 SFL 先畫（SubfileBand），SFLCTL 項目蓋在上面。
// - 點擊：武裝模式落點（onPlace），否則選取（鏡像 hitTest.itemAt）。
// - 拖放：readDropSpec → onPlace。

import {
    Fragment, useCallback, useEffect, useRef, useState, useSyncExternalStore,
} from 'react';

import { BG, COL_LINE, GRID_DOT, OVERLAY_ALPHA } from '@dspf/canvas/theme.js';
import { itemSignature } from '@dspf/canvas/styleResolver.js';
import { recordOffset } from '@dspf/canvas/windowSpec.js';
import { readDropSpec } from '@dspf/palette/Palette.js';

import { DspfItem } from './DspfItem.jsx';
import { RecordChrome } from './RecordChrome.jsx';
import { SubfileBand } from './SubfileBand.jsx';
import { useSelection } from './useSelection.js';
import { cellFromPoint, itemAtCell } from './dropMath.js';

// 無 bus（單獨掛載測試）時用空 bus。
const NO_BUS = { current: null, subscribe: () => () => {} };

export function DspfGrid ({ doc, bus = NO_BUS, onSelect, onPlace, onPlaceArmed }) {
    const ref = useRef(null);
    const [cellW, setCellW] = useState(10);

    // 每次 emit 觸發一次 re-render（item id 會重生，內容簽名當 key）。
    const versionRef = useRef(0);
    const subscribe = useCallback((cb) => {
        const off = doc.onChange(() => { versionRef.current += 1; cb(); });
        return typeof off === 'function' ? off : () => {};
    }, [doc]);
    const version = useSyncExternalStore(subscribe, () => versionRef.current);

    // 選取變動觸發 re-render（bus 通知）。
    useSelection(bus);

    // 量測容器寬度 → cellW（px）。cellH = 2 × cellW。
    // jsdom 寬度為 0，量測無效時保留初始值（測試與 SSR 安全）。
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const update = () => {
            const w = el.getBoundingClientRect().width;
            if (w > 0) setCellW(w / doc.cols);
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, [doc]);

    const active = doc.activeRecord;
    const selectedId = bus?.current ?? null;

    const gridTemplates = {
        gridTemplateColumns: `repeat(${doc.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${doc.rows}, calc(var(--cell) * 2))`,
        aspectRatio: `${doc.cols} / ${doc.rows * 2}`,
    };

    const filterItem = (it) => {
        if (it.kind === 'field' && (it.usage === 'H' || it.usage === 'P') && it.id !== selectedId) {
            return false;
        }
        if (doc.hideConditioned && it.indicators?.length && it.id !== selectedId) return false;
        return true;
    };

    const renderRecordItems = (record, isOverlay) => {
        const offset = recordOffset(record);
        return (record?.items ?? []).filter(filterItem).map((it) => (
            <DspfItem key={itemSignature(it)} item={it} record={record} doc={doc}
                      offset={offset}
                      selected={!isOverlay && it.id === selectedId} />
        ));
    };

    // SFLCTL → 連動 SFL（鏡像 drawSubfile.drawLinkedSubfile 的查法）。
    const linkedSfl = (() => {
        if (active?.type !== 'SFLCTL') return null;
        const kw = active.keywords?.find((k) => k.name === 'SFLCTL');
        if (!kw) return null;
        return doc.records.find((r) => r.name === kw.args?.[0]) ?? null;
    })();

    // 點擊：武裝 → 落點；否則選取（cell → itemAt；空處清除選取）。
    const onGridClick = (ev) => {
        const cell = cellFromPoint(
            ref.current.getBoundingClientRect(),
            ev.clientX, ev.clientY, cellW, doc.cols, doc.rows);
        if (!cell) return;
        const armed = onPlaceArmed ? onPlaceArmed() : null;
        if (armed) {
            onPlace?.(armed, cell);
            return;
        }
        const hit = itemAtCell(doc, cell);
        onSelect?.(hit ? hit.id : null);
    };

    const onDragOver = (ev) => ev.preventDefault();
    const onDrop = (ev) => {
        ev.preventDefault();
        const spec = readDropSpec(ev);
        const cell = cellFromPoint(
            ref.current.getBoundingClientRect(),
            ev.clientX, ev.clientY, cellW, doc.cols, doc.rows);
        if (spec && cell) onPlace?.(spec, cell);
    };

    const overlayRecords = doc.showOverlay
        ? doc.records.filter((r) => r !== active)
        : [];

    return (
        <div className="dspf-grid" ref={ref} data-version={version}
             onClick={onGridClick} onDragOver={onDragOver} onDrop={onDrop}
             style={{
                 ...gridTemplates,
                 '--cell': `${cellW}px`,
                 position: 'relative',
                 backgroundColor: BG,
                 backgroundImage: [
                     `radial-gradient(circle 1px at center, ${GRID_DOT} 1px, transparent 1px)`,
                     `linear-gradient(to right, ${COL_LINE} 1px, transparent 1px)`,
                 ].join(', '),
                 backgroundSize: `${cellW}px ${cellW * 2}px, ${cellW * 10}px ${cellW * 2}px`,
             }}>
            {doc.showOverlay && (
                <div className="dspf-overlay" style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: OVERLAY_ALPHA,
                    display: 'grid',
                    ...gridTemplates,
                    pointerEvents: 'none',
                    zIndex: 0,
                }}>
                    {overlayRecords.map((r) => (
                        <Fragment key={r.name}>
                            <RecordChrome record={r} cellW={cellW} />
                            {renderRecordItems(r, true)}
                        </Fragment>
                    ))}
                </div>
            )}

            {linkedSfl && (
                <SubfileBand sfl={linkedSfl} sflctl={active} doc={doc} cellW={cellW} />
            )}

            {active && <RecordChrome record={active} cellW={cellW} />}

            {renderRecordItems(active, false)}
        </div>
    );
}
