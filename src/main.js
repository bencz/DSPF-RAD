// Thin entry point. Third-party CSS is imported before application CSS so
// our theme owns the final cascade. Vite bundles both for offline use.

import '98.css/dist/98.css';
import '../styles.css';

import { boot } from './app/boot.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
