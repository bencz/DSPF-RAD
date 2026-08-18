// 選取 bus（T-06，契約 C-3）。
//
// - designer.onSelectionChange 由 bindSourceSync 指派（游標同步）。
//   本 bus 包一層保留原 handler，再把選取廣播給 React 訂閱方。
// - adopt 後按內容簽名 remap（D-10）：舊 item 的簽名在 adopt 前記下，
//   emit 後找同簽名的新 id 重新 selectItem。找不到就清空選取。

import { useCallback, useRef, useSyncExternalStore } from 'react';

import { itemSignature } from '@dspf/canvas/styleResolver.js';

export function createSelectionBus (designer, doc) {
    const listeners = new Set();
    let current = designer.selectedId ?? null;

    const notify = (id) => {
        current = id;
        for (const fn of listeners) fn(id);
    };

    const orig = designer.onSelectionChange;
    designer.onSelectionChange = (id) => {
        orig?.(id);
        notify(id);
    };

    // sigCache：null = 非 adopt emit；字串 = adopt 前選取項目的簽名。
    // Designer._refresh 在 emit 時會先把懸掛的 selectedId 清成 null，
    // 所以 remap 不能用「現值懸掛」判斷，必須以 adopt 前的簽名為主。
    let sigCache = null;

    const remember = () => {
        const id = designer.selectedId;
        if (id) {
            const it = doc.findItem(id);
            sigCache = it ? itemSignature(it) : null;
        } else {
            sigCache = null;
        }
    };
    const findByIdentity = (sig) => {
        for (const r of doc.records) {
            for (const it of r.items) {
                if (itemSignature(it) === sig) return it;
            }
        }
        return null;
    };

    // adopt 是換 records 的唯一入口。包一層以便記住舊簽名。
    const origAdopt = doc.adopt.bind(doc);
    doc.adopt = (other) => {
        remember();
        origAdopt(other);
    };

    // emit 後（adopt 觸發的那一次）依簽名重選。
    doc.onChange(() => {
        if (sigCache === null) return;
        const sig = sigCache;
        sigCache = null;

        let nextId = sig ? (findByIdentity(sig)?.id ?? null) : null;
        // Designer.selectItem 只在 id 改變時才通知；adopt 時 _refresh 已把
        // 懸掛選取清成 null，清除案例不會觸發通知，這裡主動對齊 bus。
        if (nextId !== designer.selectedId) designer.selectItem(nextId);
        if (current !== designer.selectedId) notify(designer.selectedId);
    });

    return {
        get current () { return current; },
        subscribe (fn) {
            listeners.add(fn);
            return () => listeners.delete(fn);
        },
    };
}

// React hook：bus 通知時觸發一次 re-render。bus 為 null（首次 render，
// App 的 bus state 尚未建立）時安全退化成無訂閱。
export function useSelection (bus) {
    const versionRef = useRef(0);
    const subscribe = useCallback((cb) => {
        if (!bus) return () => {};
        return bus.subscribe(() => {
            versionRef.current += 1;
            cb();
        });
    }, [bus]);
    const version = useSyncExternalStore(subscribe, () => versionRef.current);
    return version;
}
