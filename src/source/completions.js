// Context-sensitive autocomplete for DSPF source.  Inside `DSPATR(...)`
// we offer flags, inside `COLOR(...)` we offer colours, everywhere else
// we offer the keyword universe.

// Not exhaustive — IBM has hundreds of DSPF keywords — but covers what
// this designer recognises plus the common shortcuts.
const DSPF_KEYWORDS = [
    'SFL', 'SFLCTL', 'MNUBAR', 'PULLDOWN', 'WINDOW',
    'DSPSIZ', 'PRINT', 'HELP', 'CHGINPDFT', 'ENTFLDATR', 'INDARA',
    'CHECK', 'EDTCDE', 'EDTWRD', 'REFFLD', 'CMPVAL', 'COMP', 'RANGE',
    'VALUES', 'ALIAS', 'TEXT', 'CHANGE', 'DUP', 'AUTO', 'MDTOFF',
    'DSPATR', 'COLOR', 'BLINK',
    'OVERLAY', 'ASSUME', 'ERASE', 'PROTECT', 'LOCK',
    'PUTOVR', 'PUTRETAIN', 'OVRDTA', 'OVRATR',
    'CA01','CA02','CA03','CA04','CA05','CA06','CA07','CA08',
    'CA09','CA10','CA11','CA12','CA13','CA14','CA15','CA16',
    'CA17','CA18','CA19','CA20','CA21','CA22','CA23','CA24',
    'CF01','CF02','CF03','CF04','CF05','CF06','CF07','CF08',
    'CF09','CF10','CF11','CF12','CF13','CF14','CF15','CF16',
    'CF17','CF18','CF19','CF20','CF21','CF22','CF23','CF24',
    'HOME', 'ROLLUP', 'ROLLDOWN', 'PAGEUP', 'PAGEDOWN', 'CLEAR',
    'SFLPAG', 'SFLSIZ', 'SFLDSP', 'SFLDSPCTL', 'SFLCLR', 'SFLEND',
    'SFLNXTCHG', 'SFLRCDNBR', 'SFLLIN', 'SFLFOLD', 'SFLDROP',
    'SFLMSG', 'SFLMSGRCD', 'SFLMSGKEY', 'SFLPGMQ', 'SFLINZ',
    'DATFMT', 'DATSEP', 'TIMFMT', 'TIMSEP',
    'DATE', 'TIME', 'USER', 'SYSNAME', 'USRNAME',
    'DATEUSA', 'TIMEUSA', 'EUROPE', 'JOBNAME', 'NETID',
    'SNGCHCFLD', 'MLTCHCFLD', 'CHOICE', 'CHOICEACC',
    'PSHBTNFLD', 'PSHBTNCHC', 'PUSHBTNFLD', 'PUSHBTNCHC',
    'MNUBARDSP', 'MNUBARCHC', 'CNTFLD', 'ERRMSG', 'ERRMSGID',
    'WDWBORDER', 'WDWTITLE',
];

const DSPATR_FLAGS = ['HI', 'RI', 'UL', 'BL', 'ND', 'PC', 'PR', 'CS'];
const COLORS       = ['GRN', 'WHT', 'RED', 'TRQ', 'YLW', 'PNK', 'BLU'];

export function dspfCompletions (context) {
    const word = context.matchBefore(/[A-Za-z][A-Za-z0-9_]*$/);
    if (!word || (word.from === word.to && !context.explicit)) return null;

    const enclosingKw = findEnclosingKeyword(context);
    if (enclosingKw === 'DSPATR') return enumOptions(word, DSPATR_FLAGS, 'display attr');
    if (enclosingKw === 'COLOR')  return enumOptions(word, COLORS, 'colour');

    return {
        from: word.from,
        options: DSPF_KEYWORDS.map(kw => ({ label: kw, type: 'keyword' })),
        validFor: /^[A-Za-z0-9_]*$/,
    };
}

// Walk left from cursor to find the enclosing '(' (if any) and grab the
// keyword name immediately before it.  Skips balanced inner parens.
function findEnclosingKeyword (context) {
    const line       = context.state.doc.lineAt(context.pos);
    const lineText   = line.text;
    const colInLine  = context.pos - line.from;

    let depth   = 0;
    let openIdx = -1;
    for (let i = colInLine - 1; i >= 0; i--) {
        const c = lineText[i];
        if      (c === ')') depth++;
        else if (c === '(') {
            if (depth === 0) { openIdx = i; break; }
            depth--;
        }
    }
    if (openIdx < 0) return null;

    const head = lineText.slice(0, openIdx).match(/([A-Za-z][A-Za-z0-9]*)\s*$/);
    return head?.[1]?.toUpperCase() ?? null;
}

function enumOptions (word, list, detail) {
    return {
        from: word.from,
        options: list.map(label => ({ label, type: 'enum', detail })),
        validFor: /^[A-Za-z]*$/,
    };
}
