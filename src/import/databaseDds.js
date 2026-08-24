import { filterAndMergeLines } from '../parser/lineFilter.js';
import { parseSourceLine } from '../parser/lineFields.js';
import { tokenizeKeywords } from '../parser/tokenizer.js';
import { makeItem } from '../model/factories.js';

export function parseDatabaseDds (source) {
    const records = [];
    let current = null;
    let currentField = null;

    for (const line of filterAndMergeLines(String(source ?? '').split(/\r?\n/))) {
        const parsed = parseSourceLine(line);
        const keywords = tokenizeKeywords(parsed.keywordText);
        if (parsed.nameType === 'R') {
            current = { name: parsed.name || `RECORD${records.length + 1}`, fields: [] };
            records.push(current);
            currentField = null;
            continue;
        }
        // Access-path specifications reuse the name columns (K/S/O), but
        // they are not database field definitions.
        if (['K', 'S', 'O'].includes(parsed.nameType)) {
            currentField = null;
            continue;
        }
        if (parsed.name) {
            if (!current) {
                current = { name: 'RECORD1', fields: [] };
                records.push(current);
            }
            currentField = databaseField(parsed, keywords);
            current.fields.push(currentField);
            continue;
        }
        if (currentField && keywords.length) currentField.keywords.push(...keywords);
    }

    for (const record of records) {
        for (const field of record.fields) enrichField(field);
    }
    return records.filter(record => record.fields.length);
}

export function layoutDatabaseFields (fields, {
    layout = 'form', startRow = 3, labelCol = 2, fieldCol = 24,
    usage = 'B', rows = 24, cols = 80, existingItems = [], addOption = false,
} = {}) {
    const usedNames = new Set(existingItems.map(item => item.name).filter(Boolean));
    const selected = fields ?? [];
    return layout === 'subfile'
        ? layoutSubfile(selected, { startRow, labelCol, usage, rows, cols, usedNames, addOption })
        : layoutForm(selected, { startRow, labelCol, fieldCol, usage, rows, cols, usedNames });
}

function databaseField (parsed, keywords) {
    return {
        name: parsed.name.toUpperCase(),
        length: parsed.length ?? 10,
        decimals: parsed.decimals ?? 0,
        dataType: mapDataType(parsed.dataType),
        sourceDataType: parsed.dataType || 'A',
        refField: parsed.refFlag === 'R',
        keywords: keywords.slice(),
        label: parsed.name,
    };
}

function enrichField (field) {
    const text = field.keywords.find(keyword => keyword.name === 'TEXT');
    const headings = field.keywords.filter(keyword => keyword.name === 'COLHDG');
    const heading = headings.flatMap(keyword => keyword.args ?? [])
        .map(unquote).filter(Boolean).join(' ').trim();
    field.label = heading || unquote(text?.args?.join(' ')) || field.name;
}

function layoutForm (fields, options) {
    const { rows, cols, usedNames } = options;
    const items = [];
    const skipped = [];
    let row = Math.max(1, options.startRow);
    const labelCol = Math.max(1, options.labelCol);
    const fieldCol = Math.max(labelCol + 2, options.fieldCol);

    for (const source of fields) {
        if (row > rows) { skipped.push(source); continue; }
        const name = uniqueFieldName(source.name, usedNames);
        const maxLabel = Math.max(1, fieldCol - labelCol - 2);
        const label = String(source.label || source.name).slice(0, maxLabel);
        const length = Math.max(1, Math.min(source.length || 10, cols - fieldCol + 1));
        items.push(makeItem({
            kind: 'constant', row, col: labelCol, text: `${label} . :`, keywords: [],
        }));
        items.push(makeDisplayField(source, { name, row, col: fieldCol, length, usage: options.usage }));
        row += 2;
    }
    return { items, skipped };
}

function layoutSubfile (fields, options) {
    const { rows, cols, usedNames } = options;
    const items = [];
    const skipped = [];
    const headerRow = Math.max(1, options.startRow);
    const dataRow = headerRow + 1;
    if (dataRow > rows) return { items, skipped: fields.slice() };
    let col = Math.max(1, options.labelCol);

    if (options.addOption && col <= cols) {
        items.push(makeItem({ kind: 'constant', row: headerRow, col, text: 'Opt', keywords: [] }));
        items.push(makeItem({
            kind: 'field', row: dataRow, col, name: uniqueFieldName('OPT', usedNames),
            length: 1, decimals: 0, dataType: 'A', usage: 'B', keywords: [],
        }));
        col += 4;
    }

    for (const source of fields) {
        const width = Math.max(1, Math.min(source.length || 10, 30));
        if (col + width - 1 > cols) { skipped.push(source); continue; }
        const name = uniqueFieldName(source.name, usedNames);
        const label = String(source.label || source.name).slice(0, width);
        items.push(makeItem({ kind: 'constant', row: headerRow, col, text: label, keywords: [] }));
        items.push(makeDisplayField(source, {
            name, row: dataRow, col, length: width, usage: options.usage || 'O',
        }));
        col += width + 2;
    }
    return { items, skipped };
}

function makeDisplayField (source, { name, row, col, length, usage }) {
    const keywords = [];
    if (source.label && source.label !== source.name) {
        keywords.push({
            name: 'TEXT', args: [`'${String(source.label).replace(/'/g, "''")}'`], indicators: [],
        });
    }
    return makeItem({
        kind: 'field', row, col, name, length,
        decimals: source.decimals ?? 0,
        dataType: source.dataType || 'A',
        usage: usage || 'B',
        keywords,
    });
}

function mapDataType (type) {
    const value = String(type || 'A').toUpperCase();
    if (['A', 'S', 'F', 'L', 'T', 'Z'].includes(value)) return value;
    if (['P', 'B'].includes(value)) return 'S';
    return 'A';
}

function uniqueFieldName (candidate, used) {
    const base = String(candidate || 'FIELD').toUpperCase()
        .replace(/[^A-Z0-9_$#@]/g, '').slice(0, 10) || 'FIELD';
    let name = base;
    let suffix = 1;
    while (used.has(name)) {
        suffix++;
        const tail = String(suffix);
        name = base.slice(0, 10 - tail.length) + tail;
    }
    used.add(name);
    return name;
}

function unquote (value) {
    const text = String(value ?? '').trim();
    return text.startsWith("'") && text.endsWith("'")
        ? text.slice(1, -1).replace(/''/g, "'")
        : text;
}
