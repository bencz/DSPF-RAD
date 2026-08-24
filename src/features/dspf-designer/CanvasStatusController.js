export class CanvasStatusController {
    #abortController = null;

    constructor ({ canvas, cursorElement, designer, palette }) {
        this.canvas = canvas;
        this.cursorElement = cursorElement;
        this.designer = designer;
        this.palette = palette;
    }

    start () {
        this.stop();
        this.#abortController = new AbortController();
        const signal = this.#abortController.signal;
        this.canvas.addEventListener('pointermove', event => {
            const cell = this.designer.renderer.cellAt(event.clientX, event.clientY);
            this.cursorElement.textContent = cell ? `(${cell.row},${cell.col})` : '(-,-)';
            this.canvas.classList.toggle('canvas-armed', !!this.palette.getArmedSpec());
        }, { signal });
        this.canvas.addEventListener('pointerleave', () => {
            this.cursorElement.textContent = '(-,-)';
        }, { signal });
    }

    stop () {
        this.#abortController?.abort();
        this.#abortController = null;
    }
}
