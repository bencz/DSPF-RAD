export class TauriIbmiCommandError extends Error {
    constructor ({ code = 'IBMI_DESKTOP_COMMAND', message, detail = null }) {
        super(String(message ?? 'IBM i desktop command failed.'));
        this.name = 'TauriIbmiCommandError';
        this.code = String(code);
        this.detail = detail;
    }

    static from (value) {
        if (value instanceof TauriIbmiCommandError) return value;
        if (value && typeof value === 'object') {
            return new TauriIbmiCommandError({
                code: value.code,
                message: value.message,
                detail: value,
            });
        }
        return new TauriIbmiCommandError({ message: value });
    }
}
