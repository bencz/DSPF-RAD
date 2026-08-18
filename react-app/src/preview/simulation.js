// 互動模擬層（T-12，D-8）。
// choice 選中、pushbtn AID 等執行期 state 只存在這裡，絕不寫入 doc。
// 訂閱式 store：元件用 useSyncExternalStore 讀取，TestPanel 用於斷言。

const store = new Map();
const listeners = new Set();

export function simGet (sig) {
    return store.get(sig) ?? null;
}

export function simSet (sig, value) {
    store.set(sig, value);
    for (const fn of listeners) fn();
}

export function simSubscribe (fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
}

export function simClear () {
    store.clear();
    for (const fn of listeners) fn();
}
