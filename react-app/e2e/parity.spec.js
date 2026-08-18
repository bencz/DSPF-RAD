// T-14 瀏覽器對位檢查（§9.8）。
// 對同一份 doc，逐一驗證右側 React grid 與左側 Canvas2D 都把項目
// 放在相同的 grid-local (row, col)：
//   - React 側：item 的 DOM rect → grid-local 座標，對照 inline
//     grid-row/grid-column（含 WINDOW offset 與 SFL 重複列）。
//   - Canvas 側：同一 (row, col) 的 canvas 像素中心（扣 ruler 偏移）
//     → renderer.cellAt 回推必須得回 (row, col)。
// fixture：SIGNON（demo）、MULTI_WINDOW（窗內 offset）、
// SCROLL_BAR（27x132 + SFL 連動重複列）。

import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const fixture = (name) => readFileSync(new URL(`../../TESTS/${name}`, import.meta.url), 'utf8');

// 在頁面執行：回傳對位失敗清單（空 = 全 PASS）。
function verifyParity () {
    const d = window.dspfRad;
    const grid = document.querySelector('#reactGridPane .dspf-grid');
    if (!grid) return ['no grid'];
    const gridRect = grid.getBoundingClientRect();
    const r = d.designer.renderer;
    const canvasRect = r.canvas.getBoundingClientRect();
    const cellW = gridRect.width / d.doc.cols;
    const cellH = cellW * 2;
    const failures = [];

    for (const el of grid.querySelectorAll('.dspf-item')) {
        const rowMatch = el.style.gridRow.match(/^(\d+) \/ span (\d+)/);
        const colMatch = el.style.gridColumn.match(/^(\d+) \/ span (\d+)/);
        if (!rowMatch || !colMatch) { failures.push('no grid style'); continue; }
        const row = Number(rowMatch[1]);
        const col = Number(colMatch[1]);
        const sig = el.dataset.sig;

        // React 側：DOM rect → grid-local 座標。瀏覽器對小數 track 有
        // sub-pixel 捨入（4.8px 欄落在 4.797px），用 round 而非 floor。
        const er = el.getBoundingClientRect();
        const reactRow = Math.round((er.top - gridRect.top) / cellH) + 1;
        const reactCol = Math.round((er.left - gridRect.left) / cellW) + 1;
        if (reactRow !== row || reactCol !== col) {
            failures.push(`react ${sig}: expect ${row},${col} got ${reactRow},${reactCol}`);
        }

        // Canvas 側：(row, col) 的像素中心 → cellAt 回推
        const x = canvasRect.left + r.rulerCols * r.cellW + (col - 1) * r.cellW + r.cellW / 2;
        const y = canvasRect.top + r.rulerRows * r.cellH + (row - 1) * r.cellH + r.cellH / 2;
        const cell = r.cellAt(x, y);
        if (!cell || cell.row !== row || cell.col !== col) {
            failures.push(`canvas ${sig}: expect ${row},${col} got ${cell ? cell.row + ',' + cell.col : 'null'}`);
        }
    }
    return failures;
}

test.describe('parity (T-14)', () => {
    test('SIGNON demo places all items at the same grid-local position', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#reactGridPane .dspf-item')).toHaveCount(20);
        const failures = await page.evaluate(verifyParity);
        expect(failures).toEqual([]);
    });

    test('MULTI_WINDOW offsets window items identically on both panes', async ({ page }) => {
        await page.goto('/');
        const src = fixture('MULTI_WINDOW.DSPF');
        await page.evaluate((s) => window.dspfRad.load(s), src);

        const names = await page.evaluate(() => window.dspfRad.doc.records.map((r) => r.name));
        for (const name of names) {
            await page.evaluate((n) => {
                const d = window.dspfRad.doc;
                d.setActiveRecord(d.records.findIndex((r) => r.name === n));
            }, name);
            await page.waitForTimeout(150);
            const failures = await page.evaluate(verifyParity);
            expect(failures, name).toEqual([]);
        }
    });

    test('SCROLL_BAR 27x132 subfile repeats align on both panes', async ({ page }) => {
        await page.goto('/');
        const src = fixture('SCROLL_BAR.DSPF');
        await page.evaluate((s) => {
            window.dspfRad.load(s);
            const d = window.dspfRad.doc;
            // DSPSIZ(27 132) → 切模型（模擬 fileIO 的 matchModelFromDsPsiz）。
            const dspsiz = d.records[0]?.keywords?.find((k) => k.name === 'DSPSIZ');
            if (dspsiz && parseInt(dspsiz.args[0], 10) === 27) d.setModel('27x132');
            const idx = d.records.findIndex((r) => r.type === 'SFLCTL');
            if (idx >= 0) d.setActiveRecord(idx);
        }, src);
        await page.waitForTimeout(250);

        await expect(page.locator('#reactGridPane .dspf-item').first()).toBeVisible();
        const failures = await page.evaluate(verifyParity);
        expect(failures).toEqual([]);
    });
});
