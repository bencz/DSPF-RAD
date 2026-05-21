// First pass over raw DSPF source:
//   1. drop blank / comment / SEU metadata lines
//   2. fuse `+` / `-` keyword continuations into a single logical line
//
// `+` strips the next line's leading whitespace (normal keyword wrap);
// `-` keeps it verbatim (used inside multi-line literal constants where
// internal spacing matters).

export function filterAndMergeLines (rawLines) {
    const kept = stripNoiseLines(rawLines);
    return mergeContinuations(kept);
}

function stripNoiseLines (rawLines) {
    const kept = [];
    for (const raw of rawLines) {
        const padded = raw.replace(/\t/g, ' ').padEnd(80).substring(0, 80);
        const formType = padded[5];
        // Real DSPF carries 'A' in col 6.  Blank means free-format some
        // IDEs emit — we accept it.  Anything else (M*, X*, …) is tooling
        // metadata we don't care about.
        if (formType !== 'A' && formType !== ' ') continue;
        if (formType === 'A' && padded[6] === '*') continue;     // A*-metadata
        if (padded.trimStart().startsWith('*')) continue;        // pure comment
        if (padded.trim() === '') continue;
        kept.push(padded);
    }
    return kept;
}

function mergeContinuations (kept) {
    const out = [];
    for (let i = 0; i < kept.length; ) {
        const prefix = kept[i].substring(0, 44);
        let kwArea   = kept[i].substring(44).trimEnd();
        let j        = i + 1;

        while ((kwArea.endsWith('+') || kwArea.endsWith('-')) && j < kept.length) {
            const cont    = kwArea[kwArea.length - 1];
            const raw     = kept[j].substring(44).trimEnd();
            const trailer = cont === '+' ? raw.trimStart() : raw;
            kwArea = kwArea.slice(0, -1) + trailer;
            j++;
        }
        out.push(prefix + kwArea);
        i = Math.max(j, i + 1);
    }
    return out;
}
