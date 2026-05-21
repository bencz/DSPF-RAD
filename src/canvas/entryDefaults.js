// Record / doc-level defaults applied to entry fields (usage I or B) so
// the design-time preview matches what the runtime would inherit.

const DSPATR_LONG_NAMES = {
    UNDERLINE: 'UL', HIGHINTENSITY: 'HI', 'HIGH-INTENSITY': 'HI',
    REVERSEIMAGE: 'RI', 'REVERSE-IMAGE': 'RI', BLINK: 'BL',
    NONDISPLAY: 'ND', 'NON-DISPLAY': 'ND',
    PROTECT: 'PR', POSITIONCURSOR: 'PC', 'POSITION-CURSOR': 'PC',
    COLUMNSEPARATOR: 'CS', 'COLUMN-SEPARATOR': 'CS',
};

const DSPATR_CODES = ['HI','UL','RI','BL','ND','PR','PC','CS'];
const COLOR_CODES  = ['GRN','WHT','RED','TRQ','YLW','PNK','BLU'];

// Scans CHGINPDFT + ENTFLDATR on the record and on doc.records[0] (where
// doc-level keywords end up after parse).  Returns { flags: [...], color }.
export function getEntryDefaults (record, doc) {
    const flags = new Set();
    let color = null;

    const scan = (rec) => {
        if (!rec) return;
        const ip = rec.keywords?.find(k => k.name === 'CHGINPDFT');
        if (ip) {
            for (const arg of ip.args ?? []) {
                const t = String(arg).toUpperCase();
                if (DSPATR_CODES.includes(t)) flags.add(t);
                else if (COLOR_CODES.includes(t)) color = t;
            }
        }
        const ef = rec.keywords?.find(k => k.name === 'ENTFLDATR');
        if (ef) {
            const all = (ef.args ?? []).join(' ').toUpperCase();
            for (const m of all.matchAll(/\*?([A-Z][A-Z\-]+)/g)) {
                const tok    = m[1];
                const mapped = DSPATR_LONG_NAMES[tok] ?? (tok.length === 2 ? tok : null);
                if (mapped && DSPATR_CODES.includes(mapped)) flags.add(mapped);
            }
        }
    };

    if (doc) scan(doc.records[0]);
    if (record !== doc?.records?.[0]) scan(record);
    return { flags: [...flags], color };
}
