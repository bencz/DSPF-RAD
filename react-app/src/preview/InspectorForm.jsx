// TanStack Form 檢查器（T-10/T-11，D-2/D-3/D-9）。
// - 取代 legacy DOM Inspector：Designer 改接 no-op stub，本表單接管。
// - 記錄面板：name（rename，uniqueRecordName 正規化後 resync）、
//   type（setRecordType）。
// - 身分欄位：name、length、dataType、decimals、usage。
// - 屬性：COLOR（datalist 自由輸入，D-9）、DSPATR 群組（setFlag）。
// - 條件：indicators chips（parseIndicatorTokens）。
// - 文字：常數 text；L/T 型別的 DATFMT / TIMFMT。
// - onChange 即時提交（D-3），提交後以 doc 實際值 resync（處理 clamp
//   與正規化）。

import { useForm } from '@tanstack/react-form';

import { USAGES, DATA_TYPES, DSPATR_FLAGS, COLORS } from '@dspf/Attributes.js';
import { RECORD_TYPES } from '@dspf/model/constants.js';
import {
    setSingle, setFlag, parseIndicatorTokens, formatIndicatorTokens,
    flagsOf, valueOf,
} from '@dspf/model/keywords.js';

import { useSelection } from './useSelection.js';

const COLOR_OPTIONS = [...Object.keys(COLORS), 'BLK', 'GRY', 'CSP'];
const DATE_FORMATS = ['*ISO', '*JIS', '*USA', '*EUR', '*JUL', '*YMD', '*MDY', '*DMY', '*JOB'];
const TIME_FORMATS = ['*HMS', '*ISO', '*USA', '*EUR', '*JIS'];

export function InspectorForm ({ doc, bus }) {
    // 選取變動觸發 re-render。
    useSelection(bus);

    const id = bus?.current ?? null;
    const item = id ? doc.findItem(id) : null;

    return (
        <div>
            <RecordForm key={doc.activeRecordIndex} record={doc.activeRecord} doc={doc} />
            {item
                ? <ItemForm key={item.id} item={item} doc={doc} />
                : <div className="insp-empty">Nothing selected.</div>}
        </div>
    );
}

function RecordForm ({ record, doc }) {
    const form = useForm({
        defaultValues: { name: record.name, type: record.type },
    });

    const commitName = (raw) => {
        const value = raw.toUpperCase().slice(0, 10);
        doc.renameRecord(doc.activeRecordIndex, value);
        const actual = doc.activeRecord.name;
        if (actual !== value) form.setFieldValue('name', actual);
    };
    const commitType = (raw) => {
        doc.setRecordType(doc.activeRecordIndex, raw);
        const actual = doc.activeRecord.type;
        if (actual !== raw) form.setFieldValue('type', actual);
    };

    return (
        <div className="insp-form">
            <div className="insp-kw">RECORD · {record.type}</div>
            <form.Field name="name" children={(f) => (
                <label className="insp-row">Record name
                    <input
                        value={f.state.value}
                        onChange={(e) => {
                            f.handleChange(e.target.value);
                            commitName(e.target.value);
                        }} />
                </label>
            )} />
            <form.Field name="type" children={(f) => (
                <label className="insp-row">Record type
                    <select
                        value={f.state.value}
                        onChange={(e) => {
                            f.handleChange(e.target.value);
                            commitType(e.target.value);
                        }}>
                        {Object.entries(RECORD_TYPES).map(([v, t]) => (
                            <option key={v} value={v}>{t.label}</option>
                        ))}
                    </select>
                </label>
            )} />
        </div>
    );
}

function ItemForm ({ item, doc }) {
    const isField = item.kind === 'field';
    const flags = flagsOf(item, 'DSPATR');
    const form = useForm({
        defaultValues: {
            name: item.name ?? '',
            length: isField ? String(item.length ?? 10) : '',
            dataType: isField ? (item.dataType ?? 'A') : '',
            decimals: isField ? String(item.decimals ?? 0) : '',
            usage: isField ? (item.usage ?? 'B') : '',
            text: item.kind === 'constant' ? (item.text ?? '') : '',
            color: valueOf(item, 'COLOR') ?? '',
            indicators: formatIndicatorTokens(item.indicators),
            datfmt: valueOf(item, 'DATFMT') ?? '',
            timfmt: valueOf(item, 'TIMFMT') ?? '',
        },
    });

    // 提交 + resync：doc 會 clamp / 正規化（length < 1 → 1、name 大寫、
    // uniqueRecordName 去重）。resync 與表單的原始輸入比對（transform
    // 後的提交值 ≠ 使用者打的字串，例如 'new' → 'NEW'），有差異才回寫
    // 表單（D-3）。
    const commit = (field, raw, transform = (v) => v) => {
        const value = transform(raw);
        if (Number.isNaN(value)) return;
        doc.updateItem(item.id, { [field]: value });
        const actual = doc.findItem(item.id)?.[field];
        if (actual !== undefined && actual !== raw) {
            form.setFieldValue(field, String(actual));
        }
    };

    const commitColor = (raw) => {
        setSingle(item, 'COLOR', raw.trim().toUpperCase());
        doc.emit();
        const actual = valueOf(item, 'COLOR') ?? '';
        if (actual !== raw) form.setFieldValue('color', actual);
    };

    const toggleFlag = (flag, enabled) => {
        setFlag(item, 'DSPATR', flag, enabled);
        doc.emit();
    };

    const commitIndicators = (raw) => {
        item.indicators = parseIndicatorTokens(raw);
        doc.emit();
        const actual = formatIndicatorTokens(item.indicators);
        if (actual !== raw) form.setFieldValue('indicators', actual);
    };

    const commitDatfmt = (raw) => {
        setSingle(item, 'DATFMT', raw);
        doc.emit();
        const actual = valueOf(item, 'DATFMT') ?? '';
        if (actual !== raw) form.setFieldValue('datfmt', actual);
    };
    const commitTimfmt = (raw) => {
        setSingle(item, 'TIMFMT', raw);
        doc.emit();
        const actual = valueOf(item, 'TIMFMT') ?? '';
        if (actual !== raw) form.setFieldValue('timfmt', actual);
    };

    return (
        <div className="insp-form">
            <div className="insp-kw">ITEM · {item.kind}{isField ? ` · ${item.name || '(unnamed)'}` : ''}</div>

            {isField && (
                <>
                    <form.Field name="name" children={(f) => (
                        <label className="insp-row">Name
                            <input
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commit('name', e.target.value, (v) => v.toUpperCase().slice(0, 10));
                                }} />
                        </label>
                    )} />

                    <form.Field name="length" children={(f) => (
                        <label className="insp-row">Length
                            <input
                                type="number" min="1" max="9999"
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commit('length', e.target.value, Number);
                                }} />
                        </label>
                    )} />

                    <form.Field name="dataType" children={(f) => (
                        <label className="insp-row">Type
                            <select
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commit('dataType', e.target.value);
                                }}>
                                {DATA_TYPES.map((t) => (
                                    <option key={t.value} value={t.value}>{t.label}</option>
                                ))}
                            </select>
                        </label>
                    )} />

                    <form.Field name="decimals" children={(f) => (
                        <label className="insp-row">Decimals
                            <input
                                type="number" min="0" max="9"
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commit('decimals', e.target.value, Number);
                                }} />
                        </label>
                    )} />

                    <form.Field name="usage" children={(f) => (
                        <label className="insp-row">Usage
                            <select
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commit('usage', e.target.value);
                                }}>
                                {USAGES.map((u) => (
                                    <option key={u.value} value={u.value}>{u.label}</option>
                                ))}
                            </select>
                        </label>
                    )} />

                    <div className="insp-row">Attrs
                        <span className="insp-flags">
                            {Object.entries(DSPATR_FLAGS).map(([flag, label]) => (
                                <label key={flag} className="insp-flag" title={label}>
                                    <input type="checkbox"
                                        checked={flags.includes(flag)}
                                        onChange={(e) => toggleFlag(flag, e.target.checked)} />
                                    {flag}
                                </label>
                            ))}
                        </span>
                    </div>

                    <form.Field name="color" children={(f) => (
                        <label className="insp-row">Color
                            <input list="dspf-colors"
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commitColor(e.target.value);
                                }} />
                            <datalist id="dspf-colors">
                                {COLOR_OPTIONS.map((c) => <option key={c} value={c} />)}
                            </datalist>
                        </label>
                    )} />

                    <form.Field name="indicators" children={(f) => (
                        <label className="insp-row">Indicators
                            <input
                                placeholder="33 N34"
                                value={f.state.value}
                                onChange={(e) => {
                                    f.handleChange(e.target.value);
                                    commitIndicators(e.target.value);
                                }} />
                        </label>
                    )} />

                    {item.dataType === 'L' && (
                        <form.Field name="datfmt" children={(f) => (
                            <label className="insp-row">DATFMT
                                <select
                                    value={f.state.value}
                                    onChange={(e) => {
                                        f.handleChange(e.target.value);
                                        commitDatfmt(e.target.value);
                                    }}>
                                    {DATE_FORMATS.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                        )} />
                    )}

                    {item.dataType === 'T' && (
                        <form.Field name="timfmt" children={(f) => (
                            <label className="insp-row">TIMFMT
                                <select
                                    value={f.state.value}
                                    onChange={(e) => {
                                        f.handleChange(e.target.value);
                                        commitTimfmt(e.target.value);
                                    }}>
                                    {TIME_FORMATS.map((d) => <option key={d} value={d}>{d}</option>)}
                                </select>
                            </label>
                        )} />
                    )}
                </>
            )}

            {item.kind === 'constant' && (
                <form.Field name="text" children={(f) => (
                    <label className="insp-row">Text
                        <input
                            value={f.state.value}
                            onChange={(e) => {
                                f.handleChange(e.target.value);
                                commit('text', e.target.value);
                            }} />
                    </label>
                )} />
            )}

            {item.kind === 'sysvalue' && (
                <div className="insp-row">System value: <b>{item.sysName || 'DATE'}</b></div>
            )}
        </div>
    );
}
