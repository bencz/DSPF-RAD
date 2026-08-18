// T-02 冒煙測試：測試基建本身可用。
// - jsdom stub 讓 legacy GridCanvas 可掛載（T-01 驗收）。
// - ?raw fixture import 可解析 TESTS/ 檔案。

import { describe, expect, it } from 'vitest';

import { GridCanvas } from '@dspf/canvas/GridCanvas.js';
import TIME_DEMO from '../../../TESTS/TIME_DEMO.DSPF?raw';

describe('test infrastructure', () => {
    it('should mount GridCanvas without throwing', () => {
        const canvas = document.createElement('canvas');
        const gc = new GridCanvas(canvas);

        gc.document = {
            cols: 80, rows: 24,
            showOverlay: false, hideConditioned: false,
            activeRecord: { type: 'RECORD', items: [], keywords: [] },
            records: [],
        };
        expect(() => gc.draw()).not.toThrow();
        expect(canvas.getContext).toHaveBeenCalled();
    });

    it('should import TESTS fixtures via ?raw', () => {
        expect(typeof TIME_DEMO).toBe('string');
        expect(TIME_DEMO.length).toBeGreaterThan(100);
        expect(TIME_DEMO).toContain('DSPSIZ');
    });
});
