import assert from 'node:assert/strict';
import test from 'node:test';

import { specToItems } from '../src/designer/specToItem.js';

test('single-choice presets use IBM-required 2Y 0 attributes', () => {
    const [item] = specToItems({ kind: 'radioGroup' }, { row: 2, col: 3 });
    assert.equal(item.length, 2);
    assert.equal(item.dataType, 'Y');
    assert.equal(item.decimals, 0);
    assert.equal(item.usage, 'B');
});

test('multiple-choice presets create one CHCCTL hidden field per choice', () => {
    const items = specToItems(
        { kind: 'checkGroup', name: 'FLAGS' },
        { row: 2, col: 3 },
        ['FLAGSC1'],
    );
    const [field, ...controls] = items;
    const choices = field.keywords.filter(keyword => keyword.name === 'CHOICE');
    const controlKeywords = field.keywords.filter(keyword => keyword.name === 'CHCCTL');

    assert.equal(field.length, 2);
    assert.equal(controls.length, choices.length);
    assert.equal(controlKeywords.length, choices.length);
    assert.ok(controls.every(control =>
        control.usage === 'H' && control.length === 1 && control.dataType === 'Y'));
    assert.equal(new Set(controls.map(control => control.name)).size, controls.length);
    assert.ok(controlKeywords.every((keyword, index) =>
        keyword.args[1] === `&${controls[index].name};`));
});

test('palette presets do not create duplicate field names', () => {
    const [button] = specToItems(
        { kind: 'pushbtn', name: 'ACTION' },
        { row: 1, col: 1 },
        ['ACTION'],
    );
    assert.equal(button.name, 'ACTION2');
});
