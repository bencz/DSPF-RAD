// V2.1-0E preview visibility acceptance.
// The toolbar control hides the faithful React preview without changing the document.

import { test, expect } from '@playwright/test';

test('can hide and show the faithful React Preview on demand', async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    await page.goto('/');

    await expect(page.locator('#reactGridPane')).toBeVisible();
    const before = await page.evaluate(() => JSON.stringify(window.dspfRad.doc.toJSON()));

    await page.locator('#hideReactPreviewToggle').click();
    await expect(page.locator('#reactGridPane')).toBeHidden();
    await expect(page.locator('#canvasFrame')).toBeVisible();
    await expect(page.locator('#convertedPane')).toBeVisible();

    await page.locator('#hideReactPreviewToggle').click();
    await expect(page.locator('#reactGridPane')).toBeVisible();

    const after = await page.evaluate(() => JSON.stringify(window.dspfRad.doc.toJSON()));
    expect(after).toBe(before);
});
