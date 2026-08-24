import { IbmiSystemName } from './IbmiSystemName.js';

export class IbmiSourceMemberContent {
    constructor ({ library, sourceFile, member, text, revision }) {
        this.library = IbmiSystemName.normalize(library, 'library');
        this.sourceFile = IbmiSystemName.normalize(sourceFile, 'source file');
        this.member = IbmiSystemName.normalize(member, 'source member');
        this.text = String(text ?? '');
        this.revision = IbmiSourceMemberContent.requiredText(revision, 'Member revision');
        Object.freeze(this);
    }

    static requiredText (value, label) {
        const text = String(value ?? '').trim();
        if (!text) throw new TypeError(`${label} is required.`);
        return text;
    }
}
