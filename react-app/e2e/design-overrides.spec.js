// D-15 design-overlay acceptance in the browser.
// The converted pane must apply extracted OpenPencil overrides to target-side
// geometry/component without touching the document, and surface unmatched
// overrides as visible diagnostics.

import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const WCUSTSD2 = () => readFileSync('../QDDSSRC/WCUSTSD2.DSPF', 'utf8');

async function zzct01Identities (page) {
    return page.evaluate(() => {
        const record = window.dspfRad.doc.records.find((entry) => entry.name === 'ZZCT01');
        return record.items.map((item, index) => {
            const name = item.kind === 'constant' ? (item.text || 'constant')
                : item.kind === 'sysvalue' ? (item.name || 'system-value')
                    : (item.name || 'anonymous');
            return { id: item.id, kind: item.kind, name, identity: `dspf:${record.name}:${item.kind}:${name}:occurrence:${index + 1}` };
        });
    });
}

async function loadZzct01 (page) {
    await page.evaluate((text) => window.dspfRad.load(text), WCUSTSD2());
    const value = await page.locator('#recordSel option', { hasText: 'ZZCT01' }).getAttribute('value');
    await page.locator('#recordSel').selectOption(value);
}

test.describe('design overlay (OpenPencil overrides)', () => {
    test('applies overrides to grid geometry and reports unmatched entries', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1200 });
        let payload = null;
        await page.route('**/design-overrides.json', async (route) => {
            if (!payload) return route.fulfill({ status: 404, body: 'not found' });
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
        });

        // First pass: discover the real source identities from the loaded document.
        await page.goto('/');
        await loadZzct01(page);
        const items = await zzct01Identities(page);
        const locate = items.find((entry) => entry.name === 'LOCATE');
        expect(locate, 'LOCATE field exists in ZZCT01').toBeTruthy();

        payload = {
            schemaVersion: 'design-overrides/1',
            overrides: [
                { sourceIdentity: locate.identity, target: { targetCol: 7, span: 4, component: 'TextField' } },
                { sourceIdentity: 'dspf:ZZCT01:field:NOPE:occurrence:99', target: { span: 2 } },
            ],
        };

        // Reload so the app fetches the projection, then rebuild the same document.
        await page.reload();
        await expect(page.locator('#convertedPane [data-testid="converted-pane"]')).toBeVisible();
        await loadZzct01(page);

        const overridden = page.locator(`#convertedPane [data-testid="converted-item"][data-source-id="${locate.id}"]`);
        await expect(overridden).toHaveAttribute('data-override-applied', 'true');
        await expect(overridden).toHaveAttribute('data-override-component', 'TextField');
        const placement = await overridden.evaluate((el) => getComputedStyle(el).gridColumnStart + '/' + getComputedStyle(el).gridColumnEnd);
        expect(placement.replace(/\s/g, '')).toBe('7/span4');

        // A sibling WITHOUT an override keeps the automatic conversion: the
        // attribute must be absent on every non-overridden item.
        const allItems = page.locator('#convertedPane [data-testid="converted-item"]');
        const total = await allItems.count();
        expect(total).toBeGreaterThan(1);
        for (let index = 0; index < total; index++) {
            const item = allItems.nth(index);
            if (await item.getAttribute('data-source-id') === locate.id) continue;
            await expect(item, `item #${index} stays automatic`).not.toHaveAttribute('data-override-applied');
        }

        await expect(page.getByTestId('override-status')).toContainText('1 applied');
        await expect(page.getByTestId('override-status')).toContainText('1 unmatched');

        // The mapping rows carry the override into the binding list evidence.
        await expect(page.locator('[data-testid="data-binding-row"]', { hasText: locate.identity }))
            .toContainText('TextField');
    });

    test('keeps the automatic conversion when no overlay projection exists', async ({ page }) => {
        await page.setViewportSize({ width: 1600, height: 1200 });
        await page.goto('/');
        await loadZzct01(page);
        await expect(page.locator('#convertedPane [data-testid="converted-item"]').first()).toBeVisible();
        await expect(page.locator('#convertedPane [data-override-applied="true"]')).toHaveCount(0);
        await expect(page.getByTestId('override-status')).toHaveCount(0);
        // Document stays untouched by the absent overlay.
        await expect(page.locator('#convertedPane [data-testid="converted-grid"]')).toHaveAttribute('data-grid-columns', '12');
    });
});
