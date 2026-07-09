class IRInputManager {
    constructor() {
        if (IRInputManager.instance) return IRInputManager.instance;

        this.pendingInput = null;
        IRInputManager.instance = this;
    }

    waitForKey(timeoutMs = 60000) {
        if (this.pendingInput) throw new Error('already waiting for an IR key');

        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingInput = null;
                reject(new Error('IR key input timed out'));
            }, timeoutMs);

            this.pendingInput = { resolve, reject, timer };
        });
    }

    resolveKey(hexCode) {
        if (!hexCode || !this.pendingInput) return false;

        const pendingInput = this.pendingInput;
        this.pendingInput = null;
        clearTimeout(pendingInput.timer);
        pendingInput.resolve(hexCode);
        return true;
    }

    waitForConfirmation(timeoutMs = 60000) {
        return this.waitForKey(timeoutMs);
    }
}

const irInputManager = new IRInputManager();
export { IRInputManager };
export default irInputManager;
