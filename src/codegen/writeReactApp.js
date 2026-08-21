// Node-side writer for standalone generated React artifacts.
// The generated application remains independent from the designer source tree.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

export async function writeGeneratedReactApp (files, directory) {
    for (const [relativePath, content] of Object.entries(files)) {
        const target = join(directory, relativePath);
        await mkdir(dirname(target), { recursive: true });
        await writeFile(target, content, 'utf8');
    }
    return directory;
}
