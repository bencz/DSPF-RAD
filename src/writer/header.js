// 3-line `A*` box-comment block announcing a record, SEU/SDA-era separator
// style.  Parser drops A* lines, so these survive only as design-time
// chrome; the writer regenerates them fresh on every save.
//
// 80-col layout (1-indexed):
//   1-5  : sequence (spaces)
//   6    : 'A'
//   7-80 : 74 '*' for borders, OR
//          '*' + ' ' + 70-char text + ' ' + '*' for the middle row

export function pushRecordHeader (rec, out) {
    const border = '     A' + '*'.repeat(74);
    const title  = `${rec.name}  ·  ${rec.type}`.padEnd(70);
    const middle = '     A* ' + title + ' *';
    out.push(border);
    out.push(middle);
    out.push(border);
}
