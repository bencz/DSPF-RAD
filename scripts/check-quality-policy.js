import fs from 'node:fs';
import path from 'node:path';

const SOURCE_ROOTS = Object.freeze(['src', 'test', 'scripts']);
const SOURCE_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.d.ts']);
const FORBIDDEN_TYPE_PATTERNS = Object.freeze([
    Object.freeze({ label: 'explicit any annotation', pattern: /:\s*any\b/g }),
    Object.freeze({ label: 'any type assertion', pattern: /\bas\s+any\b/g }),
    Object.freeze({ label: 'any generic argument', pattern: /<\s*any(?:\s*[,>])/g }),
    Object.freeze({ label: 'JSDoc any type', pattern: /\{\s*any\s*\}/g }),
]);

class QualityPolicyChecker {
    constructor ({ rootDirectory, sourceRoots = SOURCE_ROOTS }) {
        this.rootDirectory = rootDirectory;
        this.sourceRoots = sourceRoots;
        this.violations = [];
    }

    run () {
        for (const sourceRoot of this.sourceRoots) {
            this.#visit(path.join(this.rootDirectory, sourceRoot));
        }
        if (this.violations.length) {
            for (const violation of this.violations) {
                console.error(`${violation.file}:${violation.line}:${violation.column} ` +
                    `${violation.label} is prohibited.`);
            }
            process.exitCode = 1;
            return false;
        }
        console.log('Quality policy passed: no prohibited any type was found.');
        return true;
    }

    #visit (entryPath) {
        const stat = fs.statSync(entryPath);
        if (stat.isDirectory()) {
            for (const child of fs.readdirSync(entryPath).sort()) {
                this.#visit(path.join(entryPath, child));
            }
            return;
        }
        if (!SOURCE_EXTENSIONS.has(path.extname(entryPath))) return;
        this.#checkFile(entryPath);
    }

    #checkFile (filePath) {
        const source = fs.readFileSync(filePath, 'utf8');
        for (const { label, pattern } of FORBIDDEN_TYPE_PATTERNS) {
            pattern.lastIndex = 0;
            for (let match = pattern.exec(source); match; match = pattern.exec(source)) {
                const before = source.slice(0, match.index);
                const line = before.split('\n').length;
                const lineStart = before.lastIndexOf('\n') + 1;
                this.violations.push({
                    file: path.relative(this.rootDirectory, filePath),
                    line,
                    column: match.index - lineStart + 1,
                    label,
                });
            }
        }
    }
}

new QualityPolicyChecker({ rootDirectory: process.cwd() }).run();
