// Minimal generated-app server using Node built-ins.
// It serves generated artifacts without coupling them to DSPF-RAD runtime state.

import { createServer } from 'node:http';

const CONTENT_TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.jsx': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
};

export function createGeneratedServer (files = {}, options = {}) {
    const mode = options.mode === 'http' ? 'http' : 'local';
    const apiBaseUrl = options.apiBaseUrl || (mode === 'local' ? '/api' : '');
    const server = createServer((request, response) => {
        const path = request.url?.split('?')[0] || '/';
        const filePath = path === '/' ? 'index.html' : path.replace(/^\//, '');
        const content = files[filePath];
        if (content == null) {
            response.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ error: 'not-found', path }));
            return;
        }
        const extension = filePath.slice(filePath.lastIndexOf('.'));
        response.writeHead(200, { 'content-type': CONTENT_TYPES[extension] || 'text/plain; charset=utf-8' });
        response.end(content);
    });
    server.mode = mode;
    server.apiBaseUrl = apiBaseUrl;
    return server;
}
