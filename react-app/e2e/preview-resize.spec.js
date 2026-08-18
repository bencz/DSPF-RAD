// E2E 預覽面板水平分割測試（Playwright）：
// 向左拖曳放大預覽（--preview-panel-w 增大、cellW 隨之變大），向右縮小至下限，
// 寬度跨重新載入持久化。對應 T-16 的瀏覽器層驗收。

import { test, expect } from '@playwright/test';

// 放大預覽需要垂直空間：預設 720px 視口扣除 chrome + 來源面板後，
// preview-body 只剩 ~242px，高度感知上限會壓住寬度。用較高視口模擬正常視窗。
test.use({ viewport: { width: 1600, height: 1200 } });

const readState = (page) => page.evaluate(() => ({
    varW:  getComputedStyle(document.documentElement).getPropertyValue('--preview-panel-w').trim(),
    paneW: Math.round(document.getElementById('reactGridPane').getBoundingClientRect().width),
    cell:  parseFloat(getComputedStyle(document.querySelector('.dspf-grid')).getPropertyValue('--cell')),
}));

// 真實滑鼠拖曳分割條：dx < 0 = 向左（放大），dx > 0 = 向右（縮小）。
async function dragHandle (page, dx) {
    const box = await page.locator('.preview-resize-handle').boundingBox();
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.mouse.move(cx + dx / 2, cy, { steps: 6 });
    await page.mouse.move(cx + dx, cy, { steps: 6 });
    await page.mouse.up();
}

test.describe('React preview resize handle', () => {
    test('renders a vertical col-resize splitter between canvas and preview', async ({ page }) => {
        await page.goto('/');
        const handle = page.locator('.preview-resize-handle');
        await expect(handle).toBeVisible();
        await expect(handle).toHaveCSS('cursor', 'col-resize');
    });

    test('dragging left magnifies the preview (wider pane, bigger cells)', async ({ page }) => {
        await page.goto('/');
        // cellW 初始為 10（useState 預設），mount 量測後才落到 gridW/cols；
        // 等它落定再讀 baseline，避免抓到瞬時值。
        await expect.poll(async () => (await readState(page)).cell).toBeLessThan(9);
        const before = await readState(page);
        expect(before.paneW).toBeGreaterThan(0);

        await dragHandle(page, -240); // 向左 240px → 面板變寬

        // paneW 同步（getBoundingClientRect 強制 reflow）；cell 經 ResizeObserver
        // + React re-render 異步更新，用 expect.poll 等它追上。
        await expect.poll(async () => (await readState(page)).paneW)
            .toBeGreaterThan(before.paneW + 150);
        await expect.poll(async () => (await readState(page)).cell)   // cellW 變大 = 放大效果
            .toBeGreaterThan(before.cell);
    });

    test('dragging right shrinks the pane, clamped to a minimum', async ({ page }) => {
        await page.goto('/');
        await dragHandle(page, +500); // 向右猛拖 → 觸發 MIN_W 下限

        const after = await readState(page);
        expect(after.paneW).toBeGreaterThanOrEqual(318);   // MIN_W=320（容許取整）
    });

    test('persists the width across a reload', async ({ page }) => {
        await page.goto('/');
        await dragHandle(page, -180);
        const widened = await readState(page);
        expect(widened.paneW).toBeGreaterThan(450);

        await page.reload();
        await expect(page.locator('#reactGridPane .dspf-grid')).toBeVisible();
        const restored = await readState(page);
        expect(Math.abs(restored.paneW - widened.paneW)).toBeLessThanOrEqual(3);
    });
});