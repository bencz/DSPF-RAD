// Protected-region merge shared by RPGLE and COBOL generation.  The newly
// generated skeleton owns structure; matching region bodies come from the
// previous source so handwritten logic survives regeneration.

const MARKER = /DSPF-RAD-REGION\s+(begin|end)=([^\]]+)\]/;

export function mergeProtectedRegions (previousSource, generatedSource) {
    if (!previousSource) return generatedSource;
    const previous = readRegions(previousSource);
    // Validate both sources before attempting a partial merge.
    readRegions(generatedSource);

    const eol = generatedSource.includes('\r\n') ? '\r\n' : '\n';
    const trailingEol = generatedSource.endsWith('\n');
    const lines = generatedSource.split(/\r?\n/);
    if (trailingEol) lines.pop();

    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const marker = MARKER.exec(line);
        out.push(line);
        if (!marker || marker[1] !== 'begin') continue;

        const key = marker[2];
        let end = i + 1;
        for (; end < lines.length; end++) {
            const candidate = MARKER.exec(lines[end]);
            if (candidate?.[1] === 'end' && candidate[2] === key) break;
        }
        if (end >= lines.length) {
            throw new Error(`Unclosed generated protected region: ${key}`);
        }
        if (previous.has(key)) out.push(...previous.get(key));
        else out.push(...lines.slice(i + 1, end));
        out.push(lines[end]);
        i = end;
    }
    return out.join(eol) + (trailingEol ? eol : '');
}

export function readRegions (source) {
    const regions = new Map();
    let open = null;
    for (const line of String(source ?? '').split(/\r?\n/)) {
        const marker = MARKER.exec(line);
        if (!marker) {
            if (open) open.body.push(line);
            continue;
        }
        const [, kind, key] = marker;
        if (kind === 'begin') {
            if (open) throw new Error(`Nested protected region ${key} inside ${open.key}`);
            if (regions.has(key)) throw new Error(`Duplicate protected region: ${key}`);
            open = { key, body: [] };
            continue;
        }
        if (!open || open.key !== key) {
            throw new Error(`Mismatched protected region end: ${key}`);
        }
        regions.set(key, open.body);
        open = null;
    }
    if (open) throw new Error(`Unclosed protected region: ${open.key}`);
    return regions;
}
