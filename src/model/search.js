export function searchDocument (doc, query, { limit = 100 } = {}) {
    const normalized = normalize(query);
    if (!normalized) return [];
    const tokens = normalized.split(/\s+/).filter(Boolean);
    const results = [];

    for (let recordIndex = 0; recordIndex < (doc.records ?? []).length; recordIndex++) {
        const record = doc.records[recordIndex];
        addResult(results, tokens, {
            kind: 'record', recordIndex, recordName: record.name,
            label: record.name,
            detail: `${record.type} · ${(record.items ?? []).length} item(s)`,
            searchText: [record.name, record.type, keywordText(record.keywords)],
        });

        for (const item of record.items ?? []) {
            const label = item.kind === 'constant'
                ? String(item.text || '(empty constant)')
                : String(item.name || item.kind);
            const description = textKeyword(item) || item.text || '';
            addResult(results, tokens, {
                kind: item.kind, recordIndex, recordName: record.name,
                itemId: item.id, label,
                detail: `${record.name} · row ${item.row}, col ${item.col}` +
                    (description && description !== label ? ` · ${description}` : ''),
                searchText: [record.name, item.kind, item.name, item.text,
                    description, keywordText(item.keywords)],
            });
        }
    }

    return results.sort((a, b) => b.score - a.score ||
        a.recordIndex - b.recordIndex || a.label.localeCompare(b.label)).slice(0, limit)
        .map(({ searchText: _ignored, ...result }) => result);
}

function addResult (results, tokens, candidate) {
    const haystack = normalize(candidate.searchText.flat().join(' '));
    if (!tokens.every(token => haystack.includes(token))) return;
    const label = normalize(candidate.label);
    const record = normalize(candidate.recordName);
    let score = candidate.kind === 'record' ? 20 : 10;
    if (label === tokens.join(' ')) score += 100;
    else if (label.startsWith(tokens[0])) score += 60;
    if (record === tokens.join(' ')) score += 50;
    score += tokens.reduce((sum, token) => sum + (label.includes(token) ? 10 : 0), 0);
    results.push({ ...candidate, score });
}

function keywordText (keywords) {
    return (keywords ?? []).flatMap(keyword => [
        keyword.name, ...(keyword.args ?? []), ...(keyword.indicators ?? []),
    ]).join(' ');
}

function textKeyword (item) {
    const keyword = (item.keywords ?? []).find(candidate => candidate.name === 'TEXT');
    return (keyword?.args ?? []).join(' ').replace(/^'|'$/g, '').replace(/''/g, "'");
}

function normalize (value) {
    return String(value ?? '').trim().toUpperCase();
}
