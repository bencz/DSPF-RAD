// Document-walking helpers shared by the RPGLE and COBOL generators.
// Pure functions; no side effects on the doc.

export const AID_DESCRIPTIONS = {
    CA01: 'PF1',  CA02: 'PF2',  CA03: 'Exit',   CA04: 'PF4',
    CA05: 'PF5',  CA06: 'PF6',  CA07: 'PF7',    CA08: 'PF8',
    CA09: 'PF9',  CA10: 'PF10', CA11: 'PF11',   CA12: 'Cancel',
    CA13: 'PF13', CA14: 'PF14', CA15: 'PF15',   CA16: 'PF16',
    CA17: 'PF17', CA18: 'PF18', CA19: 'PF19',   CA20: 'PF20',
    CA21: 'PF21', CA22: 'PF22', CA23: 'PF23',   CA24: 'PF24',
    CF01: 'PF1',  CF02: 'PF2',  CF03: 'Exit',   CF04: 'PF4',
    CF05: 'PF5',  CF06: 'PF6',  CF07: 'PF7',    CF08: 'PF8',
    CF09: 'PF9',  CF10: 'PF10', CF11: 'PF11',   CF12: 'Cancel',
    CF13: 'PF13', CF14: 'PF14', CF15: 'PF15',   CF16: 'PF16',
    CF17: 'PF17', CF18: 'PF18', CF19: 'PF19',   CF20: 'PF20',
    CF21: 'PF21', CF22: 'PF22', CF23: 'PF23',   CF24: 'PF24',
    HELP: 'Help', HOME: 'Home', PRINT: 'Print', CLEAR: 'Clear',
    ROLLUP:    'RollUp',     ROLLDOWN:   'RollDown',
    PAGEUP:    'PageUp',     PAGEDOWN:   'PageDown',
    ALTPAGEUP: 'AltPageUp',  ALTPAGEDWN: 'AltPageDn',
    ALTHELP:   'AltHelp',    RETKEY:     'RetKey',
    MNUCNL:    'MenuCancel',
};

// ---- AIDs (function keys) ----------------------------------------------

// CA/CF/HELP/ROLLUP/… deduped, with indicator number + friendly field name.
export function collectAids (doc) {
    const seen = new Set();
    const out  = [];
    for (const rec of doc.records) {
        for (const kw of rec.keywords ?? []) {
            const m = aidFromKeyword(kw);
            if (!m) continue;
            if (seen.has(m.pos)) continue;
            seen.add(m.pos);
            out.push(m);
        }
    }
    return out.sort((a, b) => a.pos - b.pos);
}

function aidFromKeyword (kw) {
    const name = kw.name;
    if (/^C[AF]\d{1,2}$/.test(name)) {
        const num = parseInt(name.slice(2), 10);
        let pos = parseInt(kw.args?.[0], 10);
        if (!Number.isFinite(pos)) pos = num;
        const description = unquote(kw.args?.[1]) || AID_DESCRIPTIONS[name];
        return { aid: name, pos, field: makeFieldName(name, description) };
    }
    if (AID_DESCRIPTIONS[name]) {
        const pos = parseInt(kw.args?.[0], 10);
        if (!Number.isFinite(pos)) return null;
        return { aid: name, pos, field: makeFieldName(name, AID_DESCRIPTIONS[name]) };
    }
    return null;
}

function makeFieldName (aid, description) {
    const base = (description || aid).replace(/[^A-Za-z0-9]/g, '');
    if (!base) return aid;
    return base[0].toUpperCase() + base.slice(1).toLowerCase();
}

// ---- Record picking -----------------------------------------------------

// EXFMT-able record: prefer one that hosts MNUBARDSP (its EXFMT pulls the
// menu bar onto the screen), otherwise the first record that's not a
// sub-component (SFL/PULLDOWN/MNUBAR are stitched onto another EXFMT'd
// record at runtime, not displayed standalone).
export function pickMainRecord (doc) {
    const withMbDsp = doc.records.find(r =>
        r.keywords?.some(kw => kw.name === 'MNUBARDSP'));
    if (withMbDsp) return withMbDsp;
    for (const r of doc.records) {
        if (r.type === 'SFL' || r.type === 'PULLDOWN' || r.type === 'MNUBAR') continue;
        return r;
    }
    return doc.records[0] ?? null;
}

export function pickSubfilePair (doc) {
    for (const ctl of doc.records) {
        if (ctl.type !== 'SFLCTL') continue;
        const link = ctl.keywords.find(kw => kw.name === 'SFLCTL');
        if (!link || !link.args.length) continue;
        const sfl = doc.records.find(r => r.name === link.args[0] && r.type === 'SFL');
        if (sfl) return { sfl, sflctl: ctl };
    }
    return null;
}

// ---- Action arms (menu bar / push buttons / choices) -------------------

// Menu bar: each MNUBARCHC on a MNUBAR-record's field is paired with the
// linked PULLDOWN record's CHOICE entries.  The condition checks both the
// menu choice number AND the pulldown choice number so each leaf gets its
// own handler region.
export function collectMenuArms (doc) {
    const arms = [];

    // Discover the program-side discriminator field names from MNUBARDSP.
    let mbVar = 'MNUCHC';
    let pdVar = 'PULL';
    for (const rec of doc.records) {
        const md = rec.keywords?.find(kw => kw.name === 'MNUBARDSP');
        if (md) {
            mbVar = stripAmpField(md.args?.[1]) ?? mbVar;
            pdVar = stripAmpField(md.args?.[2]) ?? pdVar;
            break;
        }
    }

    for (const rec of doc.records) {
        if (rec.type !== 'MNUBAR') continue;
        for (const item of rec.items) {
            const mbChcs = item.keywords?.filter(kw => kw.name === 'MNUBARCHC') ?? [];
            for (const mb of mbChcs) {
                const mbNum   = mb.args?.[0];
                const pullRec = mb.args?.[1];
                const mbLabel = unquote(mb.args?.slice(2).join(' '));
                const pull    = doc.records.find(r =>
                    r.type === 'PULLDOWN' && r.name === pullRec);

                if (!pull || !pull.items.length) {
                    arms.push({
                        condition: `${mbVar} = ${mbNum}`,
                        comment:   `Menu bar: ${mbLabel || '(unlabelled)'}`,
                        regionKey: `mb-${slugify(mbLabel || pullRec || mbNum)}`,
                    });
                    continue;
                }
                for (const pi of pull.items) {
                    const choices = pi.keywords?.filter(kw => kw.name === 'CHOICE') ?? [];
                    for (const c of choices) {
                        const cNum   = c.args?.[0];
                        const cLabel = unquote(c.args?.slice(1).join(' '));
                        arms.push({
                            condition: `${mbVar} = ${mbNum} And ${pdVar} = ${cNum}`,
                            comment:   `${mbLabel} > ${cLabel}`,
                            regionKey: `mb-${slugify(mbLabel)}-${slugify(cLabel)}`,
                        });
                    }
                }
            }
        }
    }
    return arms;
}

// Push buttons (PSHBTNFLD with PSHBTNCHC sub-keywords).  IBM's canonical
// spelling is PSHBTN*; we accept PUSHBTN* too.  Runtime field value is the
// chosen button number.
export function collectPushbtnArms (doc) {
    const arms = [];
    for (const rec of doc.records) {
        for (const item of rec.items) {
            const isBtnFld = item.keywords?.some(kw =>
                kw.name === 'PUSHBTNFLD' || kw.name === 'PSHBTNFLD');
            if (!isBtnFld) continue;
            const chcs = item.keywords.filter(kw =>
                kw.name === 'PUSHBTNCHC' || kw.name === 'PSHBTNCHC');
            for (const c of chcs) {
                const num   = c.args?.[0];
                const label = unquote(c.args?.slice(1).join(' '));
                arms.push({
                    condition: `${item.name} = ${num}`,
                    comment:   `Push button: ${label}`,
                    regionKey: `btn-${slugify(item.name)}-${slugify(label || num)}`,
                });
            }
        }
    }
    return arms;
}

// Standalone choice fields (SNGCHCFLD / MLTCHCFLD) NOT inside a PULLDOWN
// — those are already handled via the menu bar arms.
export function collectChoiceArms (doc) {
    const arms = [];
    for (const rec of doc.records) {
        if (rec.type === 'PULLDOWN') continue;
        for (const item of rec.items) {
            const isSng = item.keywords?.some(kw => kw.name === 'SNGCHCFLD');
            const isMlt = item.keywords?.some(kw => kw.name === 'MLTCHCFLD');
            if (!isSng && !isMlt) continue;
            const chcs = item.keywords.filter(kw => kw.name === 'CHOICE');
            for (const c of chcs) {
                const num   = c.args?.[0];
                const label = unquote(c.args?.slice(1).join(' '));
                arms.push({
                    condition: `${item.name} = ${num}`,
                    comment:   `${isSng ? 'Radio' : 'Check'} (${item.name}): ${label}`,
                    regionKey: `choice-${slugify(item.name)}-${slugify(label || num)}`,
                });
            }
        }
    }
    return arms;
}

// ---- COBOL: indicator structure ----------------------------------------

// Every indicator position referenced anywhere in the doc — used to build
// the 99-byte INDICATORS group COBOL maps onto the display file.
export function collectIndicatorPositions (doc) {
    const positions = new Set();
    const harvest = (target) => {
        if (!target) return;
        for (const ind of target.indicators ?? []) {
            const m = String(ind).match(/^N?(\d{1,2})$/);
            if (m) positions.add(parseInt(m[1], 10));
        }
        for (const kw of target.keywords ?? []) {
            for (const ind of kw.indicators ?? []) {
                const m = String(ind).match(/^N?(\d{1,2})$/);
                if (m) positions.add(parseInt(m[1], 10));
            }
        }
    };
    for (const rec of doc.records) {
        harvest(rec);
        for (const item of rec.items) harvest(item);
    }
    // AIDs often carry the indicator number as an arg (CA03(03)) rather
    // than via the conditioning slot — mix those in too.
    for (const a of collectAids(doc)) positions.add(a.pos);
    return [...positions].sort((a, b) => a - b);
}

// Indicator number attached to a conditioned keyword (e.g. SFLDSP's
// `indicators[0]`).  Lets the SFL loader recover which IN<nn> to flip.
export function indOfKeyword (target, name) {
    const kw = target.keywords?.find(k => k.name === name);
    if (!kw) return null;
    const ind = kw.indicators?.[0];
    if (!ind) return null;
    const m = String(ind).match(/^N?(\d{1,2})$/);
    return m ? parseInt(m[1], 10) : null;
}

// ---- string helpers ----------------------------------------------------

export function unquote (s) {
    if (!s) return '';
    const t = String(s).trim();
    if (t.startsWith("'") && t.endsWith("'") && t.length >= 2) {
        return t.substring(1, t.length - 1).replace(/''/g, "'");
    }
    return t;
}

export function stripAmpField (s) {
    if (!s) return null;
    const t = String(s).trim();
    if (!t) return null;
    return t.replace(/^&/, '').replace(/;$/, '').trim() || null;
}

export function slugify (s) {
    return String(s ?? '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'action';
}

export function pad2 (n) { return String(n).padStart(2, '0'); }
