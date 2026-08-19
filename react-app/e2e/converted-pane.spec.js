// V2.1-0C/0D converted pane acceptance.
// Confirm the modern pane shows the demo without changing the legacy document.

import { test, expect } from '@playwright/test';

test.describe('Modern React converted pane', () => {
    test('shows the converted SIGNON view beside the faithful previews', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1200 });
        await page.goto('/');

        await expect(page.locator('#canvasFrame')).toBeVisible();
        await expect(page.locator('#reactGridPane .dspf-grid')).toBeVisible();
        await expect(page.locator('#convertedPane')).toBeVisible();
        await expect(page.locator('#convertedPane [data-testid="converted-pane"]')).toBeVisible();
        await expect(page.locator('#convertedPane [data-testid="converted-item"]')).not.toHaveCount(0);

        await expect(page.locator('#convertedPane [data-testid="converted-grid"]'))
            .toHaveAttribute('data-grid-columns', '12');
    });

    test('dragging the converted splitter left grows Modern React and reduces Canvas', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1200 });
        await page.goto('/');

        const before = await page.evaluate(() => ({
            converted: document.getElementById('convertedPane').getBoundingClientRect().width,
            canvas: document.getElementById('canvasFrame').getBoundingClientRect().width,
        }));
        const handle = await page.locator('.converted-resize-handle').boundingBox();
        const x = handle.x + handle.width / 2;
        const y = handle.y + handle.height / 2;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x - 160, y, { steps: 8 });
        await page.mouse.up();

        const after = await page.evaluate(() => ({
            converted: document.getElementById('convertedPane').getBoundingClientRect().width,
            canvas: document.getElementById('canvasFrame').getBoundingClientRect().width,
        }));
        expect(after.converted).toBeGreaterThan(before.converted + 100);
        expect(after.canvas).toBeLessThan(before.canvas);
    });

    test('toggle does not mutate the legacy document', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1200 });
        await page.goto('/');
        const before = await page.evaluate(() => JSON.stringify(window.dspfRad.doc.toJSON()));

        const toggle = page.locator('#convertedPane .converted-toggle');
        await toggle.click();
        await expect(page.locator('#convertedPane [data-testid="converted-pane"]')).toHaveCount(0);
        await toggle.click();
        await expect(page.locator('#convertedPane [data-testid="converted-pane"]')).toBeVisible();

        const after = await page.evaluate(() => JSON.stringify(window.dspfRad.doc.toJSON()));
        expect(after).toBe(before);
    });
});
