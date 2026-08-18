// T-13 往返測試：全量 TESTS/ fixture 執行 parse → write → parse，
// 比對正規化 tuple（契約 §9.7）。
//
// 比對內容：記錄 name/type/keywords，項目 kind/row/col/name/text/
// length/usage/dataType/keywords。keyword 比 (name, args, indicators)
// 三元組，順序不敏感（writer 把型別關鍵字移到 R 行）。
// 已知不對稱：usage H/P 的欄位，writer 省略 row/col（AGENTS.md 記錄），
// 以 null 比對。

import { describe, expect, it } from 'vitest';

import { parseDspf } from '@dspf/parser/parseDspf.js';
import { writeDspf } from '@dspf/writer/writeDspf.js';

const fixtures = import.meta.glob(
    '../../../TESTS/*.{DSPF,dspf}',
    { query: '?raw', import: 'default', eager: true });

const kw = (k) => JSON.stringify({
    n: k.name,
    a: k.args ?? [],
    i: k.indicators ?? [],
});

function project (doc) {
    return doc.records.map((r) => ({
        name: r.name,
        type: r.type,
        keywords: (r.keywords ?? []).map(kw).sort(),
        items: r.items.map((it) => ({
            kind: it.kind,
            // usage H/P：writer 省略 row/col（已知不對稱），以 null 比對。
            row: (it.usage === 'H' || it.usage === 'P') ? null : it.row,
            col: (it.usage === 'H' || it.usage === 'P') ? null : it.col,
            name: it.name ?? '',
            text: it.text ?? '',
            length: it.length ?? null,
            usage: it.usage ?? '',
            dataType: it.dataType ?? '',
            keywords: (it.keywords ?? []).map(kw).sort(),
        })),
    }));
}

const entries = Object.entries(fixtures);

describe('round-trip（T-13）', () => {
    it(`should discover ${entries.length} TESTS fixtures`, () => {
        expect(entries.length).toBeGreaterThan(10);
    });

    for (const [path, src] of entries) {
        const name = path.split('/').pop();
        it(`should round-trip ${name} with tuple equality`, () => {
            const doc1 = parseDspf(src);
            const text2 = writeDspf(doc1);
            const doc2 = parseDspf(text2);
            expect(project(doc2), path).toEqual(project(doc1));
        });
    }
});
