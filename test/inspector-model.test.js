import assert from 'node:assert/strict';
import test from 'node:test';

import { rebuildTitleArgs } from '../src/inspector/record/window.js';

test('editing a window title preserves non-placement WDWTITLE options', () => {
    assert.deepEqual(rebuildTitleArgs(
        "Customer's orders",
        ["(*TEXT 'Old')", '(*COLOR YLW)', '*LEFT', '*BOTTOM'],
        ['*RIGHT', '*TOP'],
    ), [
        "(*TEXT 'Customer''s orders')",
        '(*COLOR YLW)',
        '*RIGHT',
        '*TOP',
    ]);
});
