/**
 * A strictly sequential async processing queue.
 *
 * Guarantees that at most one provisioning task runs at a time, preventing
 * DHCP/IP collisions on the dedicated provisioning Wi-Fi interface.
 */
export class ProvisioningQueue {
    constructor() {
        /** @type {Array<{ ssid: string, task: () => Promise<void> }>} */
        this._queue = [];
        this._isProcessing = false;
    }

    /**
     * Returns true if a task is currently being executed.
     * @returns {boolean}
     */
    get isProcessing() {
        return this._isProcessing;
    }

    /**
     * Returns the number of tasks waiting in the queue (excludes the running task).
     * @returns {number}
     */
    get size() {
        return this._queue.length;
    }

    /**
     * Returns a snapshot of the SSIDs waiting to be provisioned.
     * @returns {string[]}
     */
    get queuedSsids() {
        return this._queue.map(item => item.ssid);
    }

    /**
     * Adds a new provisioning task to the end of the queue and kicks off processing
     * if the queue was idle.
     *
     * @param {string} ssid - Human-readable label for logging and status reporting.
     * @param {() => Promise<void>} task - The async provisioning function to execute.
     */
    enqueue(ssid, task) {
        this._queue.push({ ssid, task });
        this._process();
    }

    /**
     * Checks whether an SSID is already queued or being actively provisioned.
     * @param {string} ssid
     * @returns {boolean}
     */
    hasQueued(ssid) {
        return this._queue.some(item => item.ssid === ssid);
    }

    async _process() {
        if (this._isProcessing || this._queue.length === 0) return;

        this._isProcessing = true;
        const { task } = this._queue.shift();

        try {
            await task();
        } finally {
            this._isProcessing = false;
            // Immediately start the next task if one is waiting.
            this._process();
        }
    }
}

export const provisioningQueue = new ProvisioningQueue();
