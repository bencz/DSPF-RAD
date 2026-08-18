// E2E 冒煙測試（Playwright）：右側 React 預覽與選取同步。
// 對應 tickets T-03/T-06 的瀏覽器層驗收。

import { test, expect } from '@playwright/test';

test.describe('React preview pane', () => {
    test('mounts and renders SIGNON demo in the grid', async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#reactGridPane .dspf-grid')).toBeVisible();
        await expect(page.locator('#reactGridPane .dspf-item')).toHaveCount(20);
        await expect(page.locator('#sbRecord')).toHaveText('SIGNON');
        await expect(page.locator('#sbItems')).toHaveText('20 items');
    });

    test('positions items on the grid', async ({ page }) => {
        await page.goto('/');
        const sig = await page.locator('.dspf-item').first().getAttribute('data-sig');
        const col = await page.locator('.dspf-item').first().evaluate((el) => el.style.gridColumn);
        expect(sig).toBeTruthy();
        expect(col).toBe('2 / span 6');   // SIGNON 常數在 row1 col2，6 字元
    });

    test('clicking a grid item selects it in both panes', async ({ page }) => {
        await page.goto('/');
        const user = page.locator('.dspf-item', { hasText: 'User' }).first();
        await user.click();

        await expect(page.locator('.dspf-selected')).toHaveCount(1);
        await expect(page.locator('.dspf-selected')).toContainText('User');

        // 左側畫布反白由 legacy Designer 負責：檢查選取 id 已設定。
        const selected = await page.evaluate(() => {
            const d = window.dspfRad;
            return d && d.designer.selectedId
                ? d.doc.findItem(d.designer.selectedId)?.text
                : null;
        });
        expect(selected).toBe('User  . . . . . . . . . . . . . . .');
    });

    test('keeps selection across a source-edit parse (signature remap)', async ({ page }) => {
        await page.goto('/');
        await page.locator('.dspf-item', { hasText: 'User' }).first().click();
        await expect(page.locator('.dspf-selected')).toHaveCount(1);

        // 改來源文字 → 300ms 後解析 adopt → 選取依簽名 remap 不丟。
        await page.evaluate(() => {
            const view = document.querySelector('#sourceEditor .cm-content').cmView.view;
            const next = view.state.doc.toString()
                .replace('User  . . . . . . . . . . . . . . .', 'UserX . . . . . . . . . . . . . . .');
            view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
        });
        await expect(page.locator('.dspf-selected')).toHaveCount(1, { timeout: 2000 });
    });

    test('screenshot the workspace', async ({ page }) => {
        await page.goto('/');
        await page.locator('.dspf-item', { hasText: 'User' }).first().click();
        await page.waitForTimeout(150);
        await page.screenshot({ path: 'e2e/workspace.png' });
    });
});

test.describe('Wave 3: windows, subfiles, drops', () => {
    // 精確 80 欄 DSPF 行建行器（與單元測試相同，避免手寫行錯位）。
    const aligned = ({ inds = ['', '', ''], nameType = ' ', name = '',
                        refFlag = ' ', length = '', dataType = ' ',
                        usage = ' ', row = '', col = '', kw = '' } = {}) =>
        ['     A',
         inds.map((s) => String(s).padEnd(3)).join(''),
         ' ', nameType, ' ', name.padEnd(10), refFlag,
         String(length).padStart(5), dataType, '  ', usage,
         String(row).padStart(3), String(col).padStart(3), kw].join('');

    test('renders WINDOW chrome and offset items', async ({ page }) => {
        await page.goto('/');
        // 真實 SDA：WINDOW 幾何內聯在 R 行（type 與 args 同一 keyword）。
        const dspf = [
            aligned({ nameType: 'R', name: 'WIN1', kw: 'WINDOW(2 6 9 65)' }),
            aligned({ name: 'F1', length: 10, dataType: 'A', usage: 'O', row: 3, col: 5 }),
        ].join('\n');
        await page.evaluate((src) => window.dspfRad.load(src), dspf);

        // 作用中記錄是 WIN1 → 窗框 div 出現
        await expect(page.locator('#reactGridPane [style*="dashed"]').first()).toBeVisible();
        // F1 窗內 (3,5) + offset (1,5) → gridRow 4、gridColumn 10
        const item = page.locator('#reactGridPane .dspf-item').first();
        await expect(item).toHaveCount(1);
        expect(await item.evaluate((el) => el.style.gridRow)).toBe('4 / span 1');
        expect(await item.evaluate((el) => el.style.gridColumn)).toBe('10 / span 10');
    });

    test('renders subfile band with repeated rows', async ({ page }) => {
        await page.goto('/');
        const dspf = [
            aligned({ nameType: 'R', name: 'SFL01', kw: 'SFL' }),
            aligned({ name: 'SEL', length: 1, dataType: 'A', usage: 'I', row: 1, col: 2 }),
            aligned({ name: 'NAME', length: 20, dataType: 'A', usage: 'O', row: 1, col: 4 }),
            aligned({ nameType: 'R', name: 'SFLCTL', kw: 'SFLCTL(SFL01)' }),
            aligned({ kw: 'SFLPAG(5)' }),
            aligned({ kw: 'SFLSIZ(50)' }),
        ].join('\n');
        await page.evaluate((src) => {
            window.dspfRad.load(src);
            window.dspfRad.doc.setActiveRecord(1);
        }, dspf);

        await expect(page.locator('#reactGridPane .dspf-sfl-band')).toBeVisible();
        await expect(page.locator('#reactGridPane .dspf-item')).toHaveCount(10);
    });

    test('drops a palette item onto the grid', async ({ page }) => {
        await page.goto('/');
        const before = await page.locator('#reactGridPane .dspf-item').count();
        await page.evaluate(() => {
            const item = document.querySelector('.palette-item[data-kind="constant"]');
            const grid = document.querySelector('#reactGridPane .dspf-grid');
            const dt = new DataTransfer();
            item.dispatchEvent(new DragEvent('dragstart', { dataTransfer: dt, bubbles: true }));
            // dragstart 處理器會用自己的 spec 覆寫 MIME，之後再蓋掉。
            dt.setData('application/x-dspf-item', JSON.stringify({ kind: 'constant', text: 'Dropped' }));
            const rect = grid.getBoundingClientRect();
            const opts = {
                dataTransfer: dt, bubbles: true, cancelable: true,
                clientX: rect.left + 55, clientY: rect.top + 25,
            };
            grid.dispatchEvent(new DragEvent('dragover', opts));
            grid.dispatchEvent(new DragEvent('drop', opts));
        });
        await expect(page.locator('#reactGridPane .dspf-item', { hasText: 'Dropped' })).toHaveCount(1);
        await expect(page.locator('#reactGridPane .dspf-item')).toHaveCount(before + 1);
    });
});

test.describe('Wave 4: TanStack form + function tests', () => {
    test('inspector shows identity fields and commits edits', async ({ page }) => {
        await page.goto('/');
        await page.locator('.dspf-item', { hasText: 'USER______' }).first().click();
        await expect(page.locator('#inspector .insp-form').first()).toBeVisible();
        await expect(page.locator('#inspector')).toContainText('USER');

        const lengthInput = page.locator('#inspector input[type="number"]').first();
        await lengthInput.fill('12');
        await lengthInput.blur();
        await page.waitForTimeout(150);

        const col = await page.locator('#reactGridPane .dspf-selected')
            .evaluate((el) => el.style.gridColumn);
        expect(col).toBe('53 / span 12');
    });

    test('function test panel runs and passes', async ({ page }) => {
        await page.goto('/');
        await page.locator('.test-run').click();
        await expect(page.locator('.test-results li').first()).toContainText('PASS');
    });

    test('interactive choice toggles glyph in the sim layer', async ({ page }) => {
        await page.goto('/');
        const aligned = ({ inds = ['', '', ''], nameType = ' ', name = '',
                            refFlag = ' ', length = '', dataType = ' ',
                            usage = ' ', row = '', col = '', kw = '' } = {}) =>
            ['     A',
             inds.map((s) => String(s).padEnd(3)).join(''),
             ' ', nameType, ' ', name.padEnd(10), refFlag,
             String(length).padStart(5), dataType, '  ', usage,
             String(row).padStart(3), String(col).padStart(3), kw].join('');
        const dspf = [
            aligned({ nameType: 'R', name: 'T' }),
            aligned({ name: 'CHC', length: 10, dataType: 'A', usage: 'B', row: 2, col: 5, kw: 'SNGCHCFLD' }),
            aligned({ kw: "CHOICE(1 'One')" }),
            aligned({ kw: "CHOICE(2 'Two')" }),
        ].join('\n');
        await page.evaluate((src) => window.dspfRad.load(src), dspf);
        await page.waitForTimeout(250);

        const choice = page.locator('.dspf-choice', { hasText: 'One' });
        await expect(choice).toContainText('◯');
        await choice.click();
        await expect(choice).toContainText('◉');
    });
});

test.describe('Wave 5: attribute + record fields', () => {
    test('COLOR edit reflects on the grid in real time', async ({ page }) => {
        await page.goto('/');
        // COLOR 只出現在 field 項目（constant 只有 text）— 點 SYSNAME 欄位。
        await page.locator('.dspf-item', { hasText: 'SYSNAME_' }).first().click();
        await page.waitForTimeout(100);

        const colorInput = page.locator('#inspector input[list="dspf-colors"]');
        await colorInput.fill('RED');
        await page.waitForTimeout(150);

        const color = await page.locator('#reactGridPane .dspf-selected')
            .evaluate((el) => el.firstChild.style.color);
        expect(color).toContain('85, 85');   // #ff5555 → rgb(255, 85, 85)
    });

    test('record rename updates the statusbar', async ({ page }) => {
        await page.goto('/');
        const nameInput = page.locator('#inspector input[placeholder], #inspector .insp-row input').first();
        await nameInput.fill('MAINMENU');
        await page.waitForTimeout(150);
        await expect(page.locator('#sbRecord')).toHaveText('MAINMENU');
    });
});
