import { pickMainRecord, usesIndara } from '../codegen/analysis.js';
import { itemWidth, itemHeight } from '../canvas/metrics.js';
import { parseWindowSpec } from '../canvas/windowSpec.js';

const INPUT_USAGES = new Set(['I', 'B']);
const DISPLAY_DATA_TYPES = new Set([
    'A', 'S', 'Y', 'N', 'I', 'D', 'X', 'F', 'M', 'L', 'T', 'Z',
    'W', 'E', 'J', 'O', 'G',
]);
const DISPLAY_USAGES = new Set(['I', 'O', 'B', 'H', 'P', 'M']);

export function validateDspf (doc, { language = null, layout = false } = {}) {
    const diagnostics = [];
    const add = (severity, code, message, context = {}) =>
        diagnostics.push({ severity, code, message, ...context });

    if (!doc?.records?.length) {
        add('error', 'NO_RECORDS', 'A DSPF must contain at least one record format.');
        return diagnostics;
    }

    const recordNames = new Set();
    for (const record of doc.records) {
        if (!isValidDdsName(record.name)) {
            add('error', 'INVALID_RECORD_NAME',
                `Record format name ${record.name || '(blank)'} is not a valid 1-10 character DDS name.`,
                { record: record.name });
        }
        if (recordNames.has(record.name)) {
            add('error', 'DUPLICATE_RECORD', `Duplicate record format ${record.name}.`,
                { record: record.name });
        }
        recordNames.add(record.name);
        validateIndicators(record, add, { record: record.name });
        for (const keyword of record.keywords ?? []) {
            validateIndicators(keyword, add, { record: record.name });
        }
        for (const spec of record.helpSpecs ?? []) {
            for (const keyword of spec.keywords ?? []) {
                validateIndicators(keyword, add, { record: record.name });
            }
        }
        validateSubfile(record, doc, add);
        const fieldNames = new Set();
        for (const item of record.items ?? []) {
            validateItem(item, record, doc, add);
            if (item.kind !== 'field' || !item.name) continue;
            if (fieldNames.has(item.name)) {
                add('error', 'DUPLICATE_FIELD',
                    `Field ${item.name} is duplicated in record ${record.name}.`,
                    { record: record.name, item: item.name });
            }
            fieldNames.add(item.name);
        }
        if (layout) validateLayout(record, doc, add);
        validateMenuLinks(record, doc, add);
        validateMenuDisplay(record, doc, add);
    }

    if (!pickMainRecord(doc)) {
        add('error', 'NO_MAIN_RECORD',
            'No displayable record format is available for EXFMT/WRITE+READ.');
    }
    if (language === 'cobol' && !usesIndara(doc)) {
        add('error', 'COBOL_REQUIRES_INDARA',
            'ILE COBOL generation requires file-level INDARA for a stable ' +
            '99-position separate indicator area.');
    }
    return diagnostics;
}

function validateItem (item, record, doc, add) {
    const context = {
        record: record.name,
        item: item.name || item.id,
        itemId: item.id,
    };
    validateIndicators(item, add, context);
    for (const keyword of item.keywords ?? []) validateIndicators(keyword, add, context);

    validateLocation(item, doc, add, context);
    if (item.kind !== 'field') return;
    if (!item.name) add('error', 'UNNAMED_FIELD', 'Named fields require a DDS name.', context);
    else if (!isValidDdsName(item.name)) {
        add('error', 'INVALID_FIELD_NAME',
            `Field name ${item.name} is not a valid 1-10 character DDS name.`, context);
    }
    if (!Number.isInteger(item.length) || item.length < 1) {
        add('error', 'INVALID_LENGTH', 'Field length must be a positive integer.', context);
    }
    if (!DISPLAY_DATA_TYPES.has(item.dataType)) {
        add('error', 'INVALID_DATA_TYPE',
            `Data type ${item.dataType || '(blank)'} is not valid for a display file field.`,
            context);
    }
    if (!DISPLAY_USAGES.has(item.usage)) {
        add('error', 'INVALID_USAGE',
            `Usage ${item.usage || '(blank)'} is not valid for a display file field.`, context);
    }

    const keywordNames = new Set((item.keywords ?? []).map(keyword => keyword.name));
    const selection = keywordNames.has('SNGCHCFLD') || keywordNames.has('MLTCHCFLD');
    const pushButton = keywordNames.has('PSHBTNFLD') || keywordNames.has('PUSHBTNFLD');
    if (selection || pushButton) validateChoiceFieldShape(item, add, context);
    if (selection) validateChoices(item, record, add, context);
    if (pushButton) validateNumberedKeywords(item, 'PSHBTNCHC', 'PUSHBTNCHC', add, context);
}

function validateLayout (record, doc, add) {
    const visible = (record.items ?? []).filter(item =>
        !(item.kind === 'field' && ['H', 'P', 'M'].includes(item.usage)));
    const windowSpec = parseWindowSpec(record);
    const maxRows = windowSpec?.rows ?? doc.rows;
    const maxCols = windowSpec?.cols ?? doc.cols;

    for (const item of visible) {
        const endRow = item.row + itemHeight(item) - 1;
        const endCol = item.col + itemWidth(item) - 1;
        if (endRow > maxRows || endCol > maxCols) {
            add('error', 'ITEM_OVERFLOW',
                `${item.name || item.text || item.id} ends at ${endRow},${endCol}, ` +
                `outside the ${maxRows}x${maxCols} layout.`, {
                    record: record.name,
                    item: item.name || item.id,
                    itemId: item.id,
                });
        }
    }

    const plain = visible.filter(item =>
        !(item.indicators?.length) && !(item.conditionLines?.length));
    for (let i = 0; i < plain.length; i++) {
        for (let j = i + 1; j < plain.length; j++) {
            if (!rectsOverlap(plain[i], plain[j])) continue;
            add('warning', 'ITEM_OVERLAP',
                `${itemLabel(plain[i])} overlaps ${itemLabel(plain[j])}.`, {
                    record: record.name,
                    item: plain[i].name || plain[i].id,
                    itemId: plain[i].id,
                });
        }
    }
}

function rectsOverlap (a, b) {
    const aRight = a.col + itemWidth(a) - 1;
    const bRight = b.col + itemWidth(b) - 1;
    const aBottom = a.row + itemHeight(a) - 1;
    const bBottom = b.row + itemHeight(b) - 1;
    return a.col <= bRight && b.col <= aRight &&
        a.row <= bBottom && b.row <= aBottom;
}

function itemLabel (item) {
    if (item.name) return item.name;
    if (item.kind === 'constant') return `'${String(item.text ?? '').slice(0, 20)}'`;
    return item.id;
}

function validateLocation (item, doc, add, context) {
    const positionless = item.kind === 'field' && ['H', 'P', 'M'].includes(item.usage);
    if (!positionless && (!Number.isInteger(item.row) || !Number.isInteger(item.col) ||
        item.row < 1 || item.row > doc.rows || item.col < 1 || item.col > doc.cols)) {
        add('error', 'INVALID_LOCATION',
            `Display location must fit the ${doc.rows}x${doc.cols} model.`, context);
    }
    for (const location of item.alternateLocations ?? []) {
        if (!/^\*[A-Z0-9_$#@]{1,7}$/.test(location.conditionName) ||
            !Number.isInteger(location.row) || !Number.isInteger(location.col) ||
            location.row < 1 || location.row > 27 ||
            location.col < 1 || location.col > 132) {
            add('error', 'INVALID_ALTERNATE_LOCATION',
                'Alternate display locations require a valid size condition and ' +
                'coordinates within 27x132.', context);
        }
    }
}

function validateChoiceFieldShape (item, add, context) {
    if (item.length !== 2 || item.dataType !== 'Y' || item.decimals !== 0 ||
        !INPUT_USAGES.has(item.usage)) {
        add('error', 'INVALID_CHOICE_FIELD',
            'SNGCHCFLD, MLTCHCFLD and PSHBTNFLD fields must be input-capable 2Y 0.',
            context);
    }
}

function validateChoices (item, record, add, context) {
    const choices = item.keywords.filter(keyword => keyword.name === 'CHOICE');
    if (!choices.length) {
        add('error', 'MISSING_CHOICES',
            'A choice field requires at least one CHOICE keyword.', context);
        return;
    }
    const seen = new Set();
    for (const choice of choices) {
        const number = parseInt(choice.args?.[0], 10);
        if (!Number.isInteger(number) || number < 1 || number > 99) {
            add('error', 'INVALID_CHOICE_NUMBER',
                'CHOICE numbers must be unique integers from 1 through 99.', context);
        } else if (seen.has(number)) {
            add('error', 'DUPLICATE_CHOICE_NUMBER',
                `CHOICE number ${number} is duplicated.`, context);
        }
        seen.add(number);
    }

    if (!item.keywords.some(keyword => keyword.name === 'MLTCHCFLD')) return;
    for (const choice of choices) {
        const number = String(choice.args?.[0] ?? '');
        const control = item.keywords.find(keyword =>
            keyword.name === 'CHCCTL' && String(keyword.args?.[0]) === number);
        const fieldName = stripFieldRef(control?.args?.[1]);
        const field = record.items.find(candidate => candidate.name === fieldName);
        if (!control || !fieldName || !field || field.length !== 1 ||
            field.dataType !== 'Y' || field.decimals !== 0 || field.usage !== 'H') {
            add('error', 'INVALID_MLTCHC_CONTROL',
                `MLTCHCFLD choice ${number || '?'} requires CHCCTL linked to a 1Y 0H field.`,
                context);
        }
    }
}

function validateNumberedKeywords (item, canonical, alias, add, context) {
    const entries = item.keywords.filter(keyword =>
        keyword.name === canonical || keyword.name === alias);
    if (!entries.length) {
        add('error', 'MISSING_PUSH_BUTTON_CHOICES',
            'A PSHBTNFLD requires at least one PSHBTNCHC keyword.', context);
        return;
    }
    const seen = new Set();
    for (const entry of entries) {
        const number = parseInt(entry.args?.[0], 10);
        if (!Number.isInteger(number) || number < 1 || number > 99 || seen.has(number)) {
            add('error', 'INVALID_PUSH_BUTTON_NUMBER',
                'PSHBTNCHC numbers must be unique integers from 1 through 99.', context);
        }
        seen.add(number);
    }
}

function validateMenuLinks (record, doc, add) {
    for (const item of record.items ?? []) {
        for (const keyword of item.keywords ?? []) {
            if (keyword.name !== 'MNUBARCHC') continue;
            if (item.length !== 2 || item.dataType !== 'Y' || item.decimals !== 0 ||
                !INPUT_USAGES.has(item.usage)) {
                add('error', 'INVALID_MNUBAR_CHOICE_FIELD',
                    'MNUBARCHC must be attached to an input-capable 2Y 0 field.',
                    { record: record.name, item: item.name || item.id });
            }
            const linked = keyword.args?.[1];
            const exists = doc.records.some(candidate =>
                candidate.type === 'PULLDOWN' && candidate.name === linked);
            if (!exists) {
                add('error', 'BROKEN_PULLDOWN_LINK',
                    `MNUBARCHC references missing PULLDOWN record ${linked || '(blank)'}.`,
                    { record: record.name, item: item.name || item.id });
            }
        }
    }
}

function validateMenuDisplay (record, doc, add) {
    for (const keyword of record.keywords ?? []) {
        if (keyword.name !== 'MNUBARDSP') continue;
        if (record.type === 'MNUBAR') {
            const pullInput = stripFieldRef(keyword.args?.[0]);
            if (pullInput && !matchesField(record, pullInput, 2, 'S', 'H')) {
                add('error', 'INVALID_MNUBARDSP_PULL_INPUT',
                    'MNUBARDSP pull-down input must reference a hidden 2S 0 field.',
                    { record: record.name });
            }
            continue;
        }
        const menuName = keyword.args?.[0];
        if (!doc.records.some(candidate =>
            candidate.name === menuName && candidate.type === 'MNUBAR')) {
            add('error', 'BROKEN_MNUBARDSP_LINK',
                `MNUBARDSP references missing MNUBAR record ${menuName || '(blank)'}.`,
                { record: record.name });
        }
        const choiceField = stripFieldRef(keyword.args?.[1]);
        if (!choiceField || !matchesField(record, choiceField, 2, 'Y', 'H')) {
            add('error', 'INVALID_MNUBARDSP_CHOICE_FIELD',
                'MNUBARDSP choice output must reference a hidden 2Y 0 field.',
                { record: record.name });
        }
        const pullInput = stripFieldRef(keyword.args?.[2]);
        if (pullInput && !matchesField(record, pullInput, 2, 'S', 'H')) {
            add('error', 'INVALID_MNUBARDSP_PULL_INPUT',
                'MNUBARDSP pull-down input must reference a hidden 2S 0 field.',
                { record: record.name });
        }
    }
}

function matchesField (record, name, length, dataType, usage) {
    const field = record.items?.find(item => item.kind === 'field' && item.name === name);
    return field?.length === length && field.dataType === dataType &&
        field.decimals === 0 && field.usage === usage;
}

function validateSubfile (record, doc, add) {
    if (record.type !== 'SFLCTL') return;
    const link = record.keywords?.find(keyword => keyword.name === 'SFLCTL');
    const sfl = link && doc.records.find(candidate =>
        candidate.name === link.args?.[0] && candidate.type === 'SFL');
    if (!sfl) {
        add('error', 'BROKEN_SFLCTL_LINK',
            `${record.name} must reference an existing SFL record.`,
            { record: record.name });
    }
    const page = keywordInt(record, 'SFLPAG');
    const size = keywordInt(record, 'SFLSIZ');
    if (!record.keywords?.some(keyword => keyword.name === 'SFLPAG')) {
        add('error', 'MISSING_SFLPAG', `${record.name} requires SFLPAG.`,
            { record: record.name });
    }
    if (!record.keywords?.some(keyword => keyword.name === 'SFLSIZ')) {
        add('error', 'MISSING_SFLSIZ', `${record.name} requires SFLSIZ.`,
            { record: record.name });
    }
    if (page != null && size != null && page > size) {
        add('error', 'SFLPAG_GT_SFLSIZ',
            `SFLPAG(${page}) cannot exceed SFLSIZ(${size}).`,
            { record: record.name });
    }
}

function validateIndicators (target, add, context) {
    const lines = [
        ...(target?.conditionLines ?? []),
        { indicators: target?.indicators ?? [] },
    ];
    for (const line of lines) {
        const indicators = line.indicators ?? [];
        if (indicators.length > 3) {
            add('error', 'TOO_MANY_INDICATORS',
                'One DDS source line can carry at most three indicator slots.', context);
        }
        for (const indicator of indicators) {
            const token = String(indicator);
            const validIndicator = /^N?(0[1-9]|[1-9][0-9])$/.test(token);
            const validDisplaySize = /^\*[A-Z0-9_$#@]{1,7}$/.test(token);
            if (!validIndicator && !validDisplaySize) {
                add('error', 'INVALID_INDICATOR',
                    `Invalid condition ${indicator}; expected indicator 01 through 99 ` +
                    'with optional N, or a display-size condition name.', context);
            }
        }
    }
}

function keywordInt (record, name) {
    const raw = record.keywords?.find(keyword => keyword.name === name)?.args?.[0];
    const value = parseInt(raw, 10);
    return Number.isFinite(value) ? value : null;
}

function stripFieldRef (value) {
    return String(value ?? '').replace(/^&/, '').replace(/;$/, '') || null;
}

function isValidDdsName (value) {
    return /^[A-Z0-9_$#@]{1,10}$/.test(String(value ?? '').toUpperCase());
}
