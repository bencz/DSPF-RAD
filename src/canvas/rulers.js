// Top + left rulers painted in the canvas margins.  Called BEFORE the
// canvas translate-to-grid, so coordinates are canvas-absolute here.

export function drawRulers (gc) {
    const { ctx, cellW, cellH, rulerCols, rulerRows } = gc;
    const cols = gc.document.cols;
    const rows = gc.document.rows;
    const gx0  = rulerCols * cellW;
    const gy0  = rulerRows * cellH;

    // Faint backdrop so the rulers read as chrome, not data.
    ctx.fillStyle = '#0a1810';
    ctx.fillRect(0, 0, gx0 + cols * cellW, gy0);     // top strip
    ctx.fillRect(0, 0, gx0, gy0 + rows * cellH);     // left strip

    ctx.fillStyle = '#5a8a5a';
    ctx.font = `${Math.max(8, Math.min(cellH * 0.7, cellW * 1.4))}px ` +
               `"SF Mono", Menlo, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign    = 'center';

    // Top ruler: tens digit highlighted at col 10, 20, …
    for (let c = 10; c <= cols; c += 10) {
        const x = gx0 + (c - 1) * cellW + cellW / 2;
        ctx.fillText(String(Math.floor(c / 10)), x, cellH / 2);
    }
    // Top ruler: units digit on every column (1..0 cycling).
    for (let c = 1; c <= cols; c++) {
        const x = gx0 + (c - 1) * cellW + cellW / 2;
        ctx.fillText(String(c % 10), x, cellH + cellH / 2);
    }

    // Left ruler: row numbers right-aligned in the strip.
    ctx.textAlign = 'right';
    for (let r = 1; r <= rows; r++) {
        const x = gx0 - 3;
        const y = gy0 + (r - 1) * cellH + cellH / 2;
        ctx.fillText(String(r), x, y);
    }

    // Crisp separator between rulers and grid.
    ctx.strokeStyle = '#1f3a1f';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, gy0 + 0.5);
    ctx.lineTo(gx0 + cols * cellW, gy0 + 0.5);
    ctx.moveTo(gx0 + 0.5, 0);
    ctx.lineTo(gx0 + 0.5, gy0 + rows * cellH);
    ctx.stroke();

    // Restore drawing defaults for the rest of draw().
    ctx.textAlign    = 'left';
    ctx.textBaseline = 'middle';
}
