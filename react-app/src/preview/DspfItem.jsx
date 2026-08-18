// 項目分派器（T-04/T-06/T-07）：
// - 外層 div 帶定位（itemStyle，含 WINDOW offset）、記錄型別 tint
//   （RECORD_BG）、選取框疊層。
// - 內層元件只畫內容與樣式（顏色/粗體/底線/角標）。
// - 點擊由 DspfGrid 容器統一處理（武裝模式落點或選取）。
// - React key 用內容簽名（D-10）。

import { memo } from 'react';

import { itemSignature } from '@dspf/canvas/styleResolver.js';
import { RECORD_BG } from '@dspf/canvas/theme.js';
import {
    hasKeyword, mnubarChoicesOf, pushbtnChoicesOf, cntfldWidth,
} from '@dspf/canvas/keywordReaders.js';

import { itemStyle } from './itemStyle.js';
import { FieldItem } from './FieldItem.jsx';
import { ConstantItem } from './ConstantItem.jsx';
import { SysvalueItem } from './SysvalueItem.jsx';
import { SimChoiceField, SimPushbtnField } from './InteractiveItems.jsx';
import { MenuBarField, CntField } from './EnptuiWidgets.jsx';

// T-15 效能：memo 化。emit 風暴（拖動、來源打字）時未變項目跳過重繪。
// updateItem 是原地 mutation（item 引用不變），預設淺比較會跳過更新 —
// 用內容簽名比較器：length/decimals 等變動也會觸發重繪（簽名變化同時
// 改變 key，導致 remount，這是可接受的代價）。
export const DspfItem = memo(function DspfItem ({ item, record, doc, offset = null, selected = false }) {
    const style = itemStyle(item, record, doc, offset);
    const tint = RECORD_BG[record?.type] ?? null;

    let inner;
    if (item.kind === 'constant') {
        inner = <ConstantItem item={item} />;
    } else if (item.kind === 'sysvalue') {
        inner = <SysvalueItem item={item} />;
    } else if (hasKeyword(item, 'SNGCHCFLD') || hasKeyword(item, 'MLTCHCFLD')) {
        inner = <SimChoiceField item={item} />;
    } else if (mnubarChoicesOf(item).length) {
        inner = <MenuBarField item={item} />;
    } else if (hasKeyword(item, 'PSHBTNFLD') || pushbtnChoicesOf(item).length) {
        inner = <SimPushbtnField item={item} />;
    } else if (cntfldWidth(item)) {
        inner = <CntField item={item} />;
    } else {
        inner = <FieldItem item={item} record={record} doc={doc} />;
    }

    return (
        <div className={'dspf-item' + (selected ? ' dspf-selected' : '')}
             style={{
                 ...style,
                 position: 'relative',
                 backgroundColor: tint ?? 'transparent',
             }}
             data-sig={itemSignature(item)}>
            {inner}
            {selected && <span className="dspf-sel" />}
        </div>
    );
}, (a, b) =>
    a.selected === b.selected &&
    a.record === b.record &&
    a.doc === b.doc &&
    a.offset?.rowOffset === b.offset?.rowOffset &&
    a.offset?.colOffset === b.offset?.colOffset &&
    itemSignature(a.item) === itemSignature(b.item));
