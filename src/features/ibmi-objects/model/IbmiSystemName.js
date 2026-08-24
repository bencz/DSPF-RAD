const FIRST_CHARACTER = /^[A-Z$#@]$/;
const REMAINING_CHARACTER = /^[A-Z0-9_$#@]$/;

export class IbmiSystemName {
    static normalize (value, label = 'object') {
        const name = String(value ?? '').trim().toUpperCase();
        const characters = [...name];
        if (characters.length < 1 || characters.length > 10 ||
            !FIRST_CHARACTER.test(characters[0]) ||
            characters.slice(1).some(character => !REMAINING_CHARACTER.test(character))) {
            throw new Error(`Invalid IBM i ${label} system name: ${value}`);
        }
        return name;
    }
}
