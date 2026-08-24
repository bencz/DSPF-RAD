export class IbmiSourceCcsid {
    static normalize (value) {
        const text = String(value ?? '').trim().toUpperCase() || '*FILE';
        if (text === '*FILE') return text;
        if (!/^\d{1,5}$/.test(text)) {
            throw new Error(`Invalid IBM i source CCSID: ${value}`);
        }
        const ccsid = Number(text);
        if (!Number.isInteger(ccsid) || ccsid < 1 || ccsid > 65533) {
            throw new RangeError(`Invalid IBM i source CCSID: ${value}`);
        }
        return String(ccsid);
    }
}
