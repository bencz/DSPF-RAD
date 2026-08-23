import assert from 'node:assert/strict';
import test from 'node:test';

import { tokenizeArguments, tokenizeKeywords } from '../src/parser/tokenizer.js';

test('argument editor preserves quoted and nested DDS arguments', () => {
    const input = "(*TEXT 'Order history') (*COLOR YLW) *LEFT *BOTTOM";
    assert.deepEqual(tokenizeArguments(input), [
        "(*TEXT 'Order history')", '(*COLOR YLW)', '*LEFT', '*BOTTOM',
    ]);
});

test('keyword tokenizer preserves doubled quotes and embedded spaces', () => {
    assert.deepEqual(tokenizeKeywords(
        "CHOICE(1 'Customer''s order') COLOR(BLU)"), [
        { name: 'CHOICE', args: ['1', "'Customer''s order'"] },
        { name: 'COLOR', args: ['BLU'] },
    ]);
});
