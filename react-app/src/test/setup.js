// Vitest global setup (env-browser-api-mocking).
// jsdom lacks browser APIs the legacy canvas modules touch at
// construction time; stub them so GridCanvas etc. can mount in tests.

import { vi } from 'vitest';

// --- ResizeObserver (GridCanvas constructor observes the canvas) --------
// 注意：mock 必須可用 new 建立（GridCanvas 用 `new ResizeObserver(...)`），
// 不能用 arrow function（不可建構）。
globalThis.ResizeObserver = vi.fn(function () {
    return { observe: vi.fn(), unobserve: vi.fn(), disconnect: vi.fn() };
});

// --- IntersectionObserver (defensive; unused today) ----------------------
globalThis.IntersectionObserver = vi.fn(function () {
    return {
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
    };
});

// --- matchMedia (Theme.js follows prefers-color-scheme) -------------------
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    })),
});

// --- canvas 2D context (jsdom returns null for getContext('2d')) ---------
// Proxy: any method called becomes a vi.fn(); measureText returns a width
// so text-measuring code (window titles, ENPTUI) does not crash.
const canvasCtx = new Proxy({}, {
    get (target, prop) {
        if (prop === 'measureText') {
            return (text) => ({ width: String(text).length * 8 });
        }
        if (prop in target) return target[prop];
        return (target[prop] = vi.fn());
    },
    set (target, prop, value) {
        target[prop] = value;
        return true;
    },
});
HTMLCanvasElement.prototype.getContext = vi.fn(() => canvasCtx);

// --- jest-dom matchers -----------------------------------------------------
import '@testing-library/jest-dom/vitest';

// vitest globals: false → testing-library 不會自動註冊 cleanup。
// 每個測試後清掉渲染的 DOM，避免跨測試累積（重複元素）。
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
