// RPGLE skeleton generator.  Emits a `**FREE` program with protected
// regions — code inside `[DSPF-RAD-REGION begin=... end=...]` blocks is
// preserved across regenerations when `previousSource` is supplied.

import {
    collectAids, collectMenuArms, collectPushbtnArms, collectChoiceArms,
    collectIndicatorPositions, indicatorConditionsOf, usesIndara,
    uniqueRegionKeyGroups, pickMainRecord, pickSubfilePairs,
    pickPulldownRecords, pad2,
} from './analysis.js';
import { ibmiName } from '../model/factories.js';
import { mergeProtectedRegions } from './protectedRegions.js';

export function generateRpgle (doc, {
    programName = 'PROGRAM',
    dspfName    = 'DSPF',
    previousSource = null,
} = {}) {
    programName = ibmiName(programName, 'PROGRAM');
    dspfName = ibmiName(dspfName, 'DSPFILE');
    const aids       = collectAids(doc);
    const mainRecord = pickMainRecord(doc);
    const sflPairs   = prepareSubfilePairs(pickSubfilePairs(doc));
    const pulldowns  = pickPulldownRecords(doc);
    const [menuArms, btnArms, chcArms] = uniqueRegionKeyGroups([
        collectMenuArms(doc), collectPushbtnArms(doc), collectChoiceArms(doc),
    ]);
    const indara     = usesIndara(doc);

    const indDS    = renderIndDS(collectIndicatorPositions(doc));
    const aidArms  = renderAidArms(aids, indara);
    const menuBlk  = renderArmsBlock('Menu bar actions', menuArms);
    const btnBlk   = renderArmsBlock('Push buttons',     btnArms);
    const chcBlk   = renderArmsBlock('Choice fields',    chcArms);

    const out = [];
    out.push(`**FREE`);
    out.push(``);
    out.push(...prologue(programName, dspfName, doc));
    out.push(``);
    out.push(`Ctl-Opt Main(${programName}_main) DftActGrp(*No);`);
    out.push(``);
    out.push(...renderFileDeclaration(dspfName, sflPairs, indara));
    for (const pair of sflPairs) {
        out.push(`Dcl-S ${pair.rrn} Packed(5:0) Inz(0);`);
    }
    if (sflPairs.length > 1) {
        out.push(`Dcl-S WkScreen Char(10) Inz('${sflPairs[0].sflctl.name}');`);
    }
    if (indara) {
        out.push(``);
        out.push(`Dcl-Ds WkInd Qualified Len(99);`);
        out.push(indDS || `  AllIndicators Char(99) Pos(1);`);
        out.push(`End-Ds;`);
    }
    out.push(``);
    out.push(`Dcl-Proc ${programName}_main;`);
    out.push(`  Dcl-S done Ind Inz(*Off);`);
    out.push(``);
    out.push(`  // [DSPF-RAD-REGION begin=startup]`);
    out.push(`  // Run-once initialisation (open files, fetch parameters, ...).`);
    out.push(`  // [DSPF-RAD-REGION end=startup]`);
    out.push(``);
    out.push(`  Open ${dspfName};`);
    out.push(...renderPulldownSetup(pulldowns));
    out.push(`  Dou done;`);
    out.push(`    // [DSPF-RAD-REGION begin=before-display]`);
    out.push(`    // Populate fields for the next display operation.`);
    out.push(`    // [DSPF-RAD-REGION end=before-display]`);
    out.push(...renderDisplayLoop(sflPairs, mainRecord, dspfName, indara));
    out.push(``);
    out.push(`    Select;`);
    if (aidArms)  out.push(aidArms);
    if (menuBlk)  out.push(menuBlk);
    if (btnBlk)   out.push(btnBlk);
    if (chcBlk)   out.push(chcBlk);
    out.push(...renderOtherArm(sflPairs, dspfName));
    out.push(`    EndSl;`);
    out.push(`  EndDo;`);
    out.push(``);
    out.push(`  Close ${dspfName};`);
    out.push(`  // [DSPF-RAD-REGION begin=shutdown]`);
    out.push(`  // Cleanup (close files, log, ...).`);
    out.push(`  // [DSPF-RAD-REGION end=shutdown]`);
    out.push(`  Return;`);
    out.push(`End-Proc;`);

    const generated = out.join('\n') + '\n';
    return mergeProtectedRegions(previousSource, generated);
}

function prepareSubfilePairs (pairs) {
    const seen = new Map();
    return pairs.map((pair, index) => {
        const base = regionPart(pair.sfl.name);
        const count = (seen.get(base) ?? 0) + 1;
        seen.set(base, count);
        return {
            ...pair,
            // Keep the legacy first-pair name so existing protected code
            // continues to compile after regeneration.
            rrn: index === 0 ? 'WkSflRrn' : `WkSflRrn${pad2(index + 1)}`,
            regionKey: count === 1 ? base : `${base}-${count}`,
        };
    });
}

function regionPart (name) {
    return String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'subfile';
}

function renderFileDeclaration (dspfName, pairs, indara) {
    if (pairs.length <= 1) {
        const sfile = pairs.length ? ` SFile(${pairs[0].sfl.name}:${pairs[0].rrn})` : '';
        return [
            `Dcl-F ${dspfName} Workstn${sfile}${indara ? ' IndDS(WkInd)' : ''} UsrOpn;`,
        ];
    }
    return [
        `Dcl-F ${dspfName} Workstn`,
        ...pairs.map(pair => `  SFile(${pair.sfl.name}:${pair.rrn})`),
        `  ${indara ? 'IndDS(WkInd) ' : ''}UsrOpn;`,
    ];
}

function renderPulldownSetup (records) {
    if (!records.length) return [];
    const lines = [
        `  // [DSPF-RAD-REGION begin=prepare-pulldowns]`,
        `  // Populate program-to-system fields used by pulldown choices.`,
        `  // [DSPF-RAD-REGION end=prepare-pulldowns]`,
    ];
    for (const record of records) lines.push(`  Write ${record.name};`);
    lines.push(``);
    return lines;
}

function prologue (programName, dspfName, doc) {
    return [
        `// =====================================================================`,
        `// Program ${programName}`,
        `// Generated by DSPF-RAD from ${dspfName}`,
        ...wrapRecordNames('// Source records: ', doc.records),
        `// Edit hint: code inside DSPF-RAD protected-region blocks is`,
        `//            preserved across regenerations.  Everything outside the`,
        `//            regions is rewritten when you regenerate from the RAD.`,
        `// =====================================================================`,
    ];
}

function wrapRecordNames (prefix, records, width = 80) {
    const tokens = records.map((record, index) =>
        record.name + (index < records.length - 1 ? ',' : ''));
    const continuation = '//                 ';
    const lines = [];
    let line = prefix;
    for (const token of tokens) {
        const separator = line === prefix || line === continuation ? '' : ' ';
        if (line.length + separator.length + token.length > width &&
            line !== prefix && line !== continuation) {
            lines.push(line);
            line = continuation + token;
        } else {
            line += separator + token;
        }
    }
    lines.push(line);
    return lines;
}

function renderIndDS (positions) {
    const lines = [`  AllIndicators Char(99) Pos(1);`];
    for (const pos of positions) {
        lines.push(`  In${pad2(pos)} Ind Pos(${pos});`);
    }
    return lines.join('\n');
}

function renderAidArms (aids, indara) {
    return aids.map(aid => {
        const key        = `In${pad2(aid.pos)}`;
        const ref        = indara ? `WkInd.${key}` : `*${key}`;
        const isExitLike = /^C[AF](03|12)$/.test(aid.aid);
        const inner      = isExitLike ? `done = *On;` : '';
        return [
            `      When ${ref};`,
            `        // [DSPF-RAD-REGION begin=on-${key.toLowerCase()}]`,
            `        ${inner}`.trimEnd(),
            `        // [DSPF-RAD-REGION end=on-${key.toLowerCase()}]`,
        ].filter(Boolean).join('\n');
    }).join('\n');
}

function renderArmsBlock (title, list) {
    if (!list.length) return '';
    const lines = [`      // ---- ${title} ----`];
    for (const a of list) {
        lines.push(`      When ${a.condition};`);
        lines.push(`        // ${a.comment}`);
        lines.push(`        // [DSPF-RAD-REGION begin=${a.regionKey}]`);
        lines.push(`        // [DSPF-RAD-REGION end=${a.regionKey}]`);
    }
    return lines.join('\n');
}

function renderDisplayLoop (sflPairs, mainRecord, dspfName, indara) {
    const out = [];
    if (sflPairs.length === 1) {
        out.push(...renderSubfileDisplay(sflPairs[0], indara, '    '));
    } else if (sflPairs.length > 1) {
        out.push(`    // [DSPF-RAD-REGION begin=select-subfile-screen]`);
        out.push(`    // Set WkScreen to the SFLCTL format that should be interactive.`);
        out.push(`    // [DSPF-RAD-REGION end=select-subfile-screen]`);
        out.push(`    Select;`);
        for (const pair of sflPairs) {
            out.push(`      When WkScreen = '${pair.sflctl.name}';`);
            out.push(...renderSubfileDisplay(pair, indara, '        '));
        }
        out.push(`      Other;`);
        out.push(`        WkScreen = '${sflPairs[0].sflctl.name}';`);
        out.push(`        Iter;`);
        out.push(`    EndSl;`);
    } else if (mainRecord) {
        out.push(``);
        out.push(`    Exfmt ${mainRecord.name};`);
    } else {
        out.push(`    // No suitable record found - add Exfmt for your main display.`);
    }
    return out;
}

function renderSubfileDisplay (pair, indara, indent) {
    const out = [];
    const clear = subfileClearOperation(pair);
    out.push(`${indent}// [DSPF-RAD-REGION begin=load-${pair.regionKey}]`);
    out.push(`${indent}// Fill ${pair.sfl.name} subfile records here.  Suggested skeleton:`);
    for (const line of renderRpgIndicatorSteps(
        clear.conditions, indara, clear.keyword)) {
        out.push(`${indent}//   ${line}`);
    }
    out.push(`${indent}//   Write ${pair.sflctl.name};`);
    for (const line of renderRpgIndicatorSteps(
        clear.conditions, indara, 'reset', true)) {
        out.push(`${indent}//   ${line}`);
    }
    out.push(`${indent}//   Dou %Eof(...);`);
    out.push(`${indent}//     Read your data source ...`);
    out.push(`${indent}//     ${pair.rrn} += 1;`);
    out.push(`${indent}//     Write ${pair.sfl.name};`);
    out.push(`${indent}//   EndDo;`);
    for (const name of ['SFLDSP', 'SFLDSPCTL']) {
        for (const line of renderRpgIndicatorSteps(
            indicatorConditionsOf(pair.sflctl, name), indara, name)) {
            out.push(`${indent}//   ${line}`);
        }
    }
    out.push(`${indent}// [DSPF-RAD-REGION end=load-${pair.regionKey}]`);
    out.push(``);
    out.push(`${indent}Exfmt ${pair.sflctl.name};`);
    return out;
}

function subfileClearOperation (pair) {
    for (const keyword of ['SFLCLR', 'SFLDLT']) {
        const conditions = indicatorConditionsOf(pair.sflctl, keyword);
        if (conditions.length) return { keyword, conditions };
    }
    return { keyword: 'SFLCLR/SFLDLT', conditions: [] };
}

function renderRpgIndicatorSteps (conditions, indara, label, invert = false) {
    return conditions.map(condition => {
        const ref = indara
            ? `WkInd.In${pad2(condition.pos)}`
            : `*In${pad2(condition.pos)}`;
        const on = invert ? !condition.on : condition.on;
        return `${ref} = ${on ? '*On' : '*Off'};  // ${label}`;
    });
}

function renderOtherArm (sflPairs, dspfName) {
    const out = [];
    out.push(`      Other;`);
    out.push(`        // [DSPF-RAD-REGION begin=on-enter]`);
    out.push(`        // Handle Enter / data-bearing AID keys with no more specific match.`);
    out.push(`        // [DSPF-RAD-REGION end=on-enter]`);
    for (const pair of sflPairs) {
        out.push(`        // Changed rows from ${pair.sfl.name}:`);
        out.push(`        //   ReadC ${pair.sfl.name};`);
        out.push(`        //   Dow Not %Eof(${dspfName});`);
        out.push(`        //     // process changed row`);
        out.push(`        //     ReadC ${pair.sfl.name};`);
        out.push(`        //   EndDo;`);
        out.push(`        // [DSPF-RAD-REGION begin=changed-${pair.regionKey}]`);
        out.push(`        // [DSPF-RAD-REGION end=changed-${pair.regionKey}]`);
    }
    return out;
}
