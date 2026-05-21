// Thin entry point.  Real work lives in app/boot.js + its siblings.

import { boot } from './app/boot.js';

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}
