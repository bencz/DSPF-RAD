// T-16 預覽面板水平分割測試：
// - 向左拖曳放大（--preview-panel-w 增大）。
// - 向右拖縮小，下限 MIN_W。
// - 釋放時持久化到 localStorage；bind 時還原。
// - parseAspect 純函數解析 aspect-ratio 字串。

import { describe, expect, it, beforeEach } from 'vitest';

import { bindPreviewResize, parseAspect } from '../previewResize.js';

// This jsdom build exposes no localStorage (global or on window).  Provide a
// functional in-memory Storage so the persistence path is actually exercised
// (env-browser-api-mocking) — real get/set semantics, not vi.fn() stubs.
const store = new Map();
Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
        getItem:    (k) => (store.has(k) ? store.get(k) : null),
        setItem:    (k, v) => { store.set(k, String(v)); },
        removeItem: (k) => { store.delete(k); },
        clear:      () => { store.clear(); },
    },
});

const KEY = 'dspf-rad:preview-w';

// jsdom 可能沒有 PointerEvent；fallback 到 Event + defineProperty，
// handler 只讀 clientX/clientY。
function pointer (type, x, y) {
    let ev;
    try {
        ev = new window.PointerEvent(type, { clientX: x, clientY: y, bubbles: true });
    } catch {
        ev = new window.Event(type, { bubbles: true });
        Object.defineProperty(ev, 'clientX', { value: x });
        Object.defineProperty(ev, 'clientY', { value: y });
    }
    return ev;
}

// 模組寫入的是 :root inline var；直接讀它最確定（jsdom 無樣式表，
// computed 值在拖曳前為空）。
function inlineVar () {
    return document.documentElement.style.getPropertyValue('--preview-panel-w');
}

describe('bindPreviewResize', () => {
    let handle;

    beforeEach(() => {
        localStorage.clear();
        document.documentElement.style.removeProperty('--preview-panel-w');
        handle = document.createElement('div');
        handle.className = 'preview-resize-handle';
    });

    it('should grow the pane when dragging left', () => {
        bindPreviewResize({ handle });
        handle.dispatchEvent(pointer('pointerdown', 500, 300));
        handle.dispatchEvent(pointer('pointermove', 300, 300)); // left by 200 → +200
        handle.dispatchEvent(pointer('pointerup',   300, 300));
        expect(inlineVar()).toBe('600px');
    });

    it('should shrink the pane when dragging right, clamped to MIN_W', () => {
        bindPreviewResize({ handle });
        handle.dispatchEvent(pointer('pointerdown', 500, 300));
        handle.dispatchEvent(pointer('pointermove', 900, 300)); // right by 400 → below min
        handle.dispatchEvent(pointer('pointerup',   900, 300));
        expect(inlineVar()).toBe('320px');
    });

    it('should persist the width to localStorage on release', () => {
        bindPreviewResize({ handle });
        handle.dispatchEvent(pointer('pointerdown', 500, 300));
        handle.dispatchEvent(pointer('pointermove', 400, 300)); // left by 100 → 500
        handle.dispatchEvent(pointer('pointerup',   400, 300));
        expect(localStorage.getItem(KEY)).toBe('500px');
    });

    it('should restore a persisted width on bind', () => {
        localStorage.setItem(KEY, '520px');
        bindPreviewResize({ handle });
        expect(inlineVar()).toBe('520px');
    });

    it('should not change the pane without a pointerdown first', () => {
        bindPreviewResize({ handle });
        handle.dispatchEvent(pointer('pointermove', 300, 300)); // no drag state
        expect(inlineVar()).toBe('');
    });
});

describe('parseAspect', () => {
    it('should parse "80 / 48" to width/height ratio', () => {
        expect(parseAspect('80 / 48')).toBeCloseTo(1.6667, 3);
    });

    it('should return 0 for non-numeric or malformed input', () => {
        expect(parseAspect('auto')).toBe(0);
        expect(parseAspect('')).toBe(0);
        expect(parseAspect(undefined)).toBe(0);
    });
});