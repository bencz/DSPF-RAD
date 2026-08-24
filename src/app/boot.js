import { PRODUCT } from '../product.js';
import { IronTermApplication } from './IronTermApplication.js';

// Minimal error boundary around the class-based composition root.
export function boot () {
    try {
        new IronTermApplication().start();
    } catch (error) {
        console.error('[ironterm] boot failed:', error);
        const status = document.getElementById('status');
        if (status) {
            status.textContent = `BOOT ERROR (see console): ${error.message || error}`;
            status.className = 'error';
        }
        document.title = `[!] ${PRODUCT.name} boot error`;
    }
}
