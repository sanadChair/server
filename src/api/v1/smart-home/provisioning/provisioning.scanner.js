import { EventEmitter } from 'events';
import logger from '#utils/logger.js';
import WifiAdapter from './provisioning.wifi-adapter.js';
import { parseMacFromSsid } from './provisioning.crypto.js';

const SSID_PATTERN = /^smarthome_/i;
const IFACE = process.env.PROVISIONING_INTERFACE || 'wlan1';
const IS_MOCK_MODE = process.env.MOCK_MODE === 'true';

/**
 * On-demand Wi-Fi scanner.
 *
 * Scans only when `scan()` is explicitly called (e.g. via the POST /scan API).
 * Results are stored in `_discovered` and returned directly from `scan()`.
 * No background interval is used.
 *
 * @extends EventEmitter
 * @emits device_detected - Payload: { ssid: string, macAddress: string }
 */
class ProvisioningScanner extends EventEmitter {
    constructor() {
        super();
        /** @type {Set<string>} SSIDs discovered and not yet provisioned */
        this._discovered = new Set();
        this._isScanning = false;
    }

    /**
     * Returns a snapshot of the currently discovered unprovisioned SSIDs.
     * @returns {string[]}
     */
    get discoveredSsids() {
        return [...this._discovered];
    }

    /**
     * Returns true if a scan is currently in progress.
     * @returns {boolean}
     */
    get isScanning() {
        return this._isScanning;
    }

    /**
     * Performs a single Wi-Fi scan and updates the discovered set.
     * Returns the list of newly found and all currently visible smarthome SSIDs.
     *
     * @returns {Promise<{ discovered: string[], newlyFound: string[] }>}
     * @throws {Error} If a scan is already running.
     */
    async scan() {
        if (this._isScanning) {
            throw Object.assign(
                new Error('A scan is already in progress. Please wait for it to complete.'),
                { statusCode: 409 }
            );
        }

        this._isScanning = true;
        logger.info(`[PROVISIONING SCANNER] Manual scan triggered on interface "${IFACE}"`);

        try {
            return await this._runScan();
        } finally {
            this._isScanning = false;
        }
    }

    /**
     * Removes an SSID from the discovered set after successful provisioning.
     * @param {string} ssid
     */
    markProvisioned(ssid) {
        this._discovered.delete(ssid);
        logger.info(`[PROVISIONING SCANNER] Marked "${ssid}" as provisioned.`);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    async _runScan() {
        const networks = await WifiAdapter.scanNetworks(IFACE);
        const smartHomeNetworks = networks.filter(n => SSID_PATTERN.test(n.ssid));

        const newlyFound = [];

        for (const network of smartHomeNetworks) {
            const macAddress = parseMacFromSsid(network.ssid);
            if (!macAddress) continue;

            if (!this._discovered.has(network.ssid)) {
                this._discovered.add(network.ssid);
                newlyFound.push(network.ssid);
                logger.info(
                    `[PROVISIONING SCANNER] New device found: "${network.ssid}" (MAC: ${macAddress})`
                );
                this.emit('device_detected', { ssid: network.ssid, macAddress });
            }
        }

        // Prune SSIDs no longer visible (left SoftAP mode — already provisioned or powered off).
        const visibleSsids = new Set(smartHomeNetworks.map(n => n.ssid));
        for (const ssid of this._discovered) {
            if (!visibleSsids.has(ssid)) {
                this._discovered.delete(ssid);
                logger.info(`[PROVISIONING SCANNER] "${ssid}" no longer visible — removed.`);
            }
        }

        logger.info(
            `[PROVISIONING SCANNER] Scan complete. ` +
            `Found ${smartHomeNetworks.length} smarthome network(s), ${newlyFound.length} new.`
        );

        return { discovered: this.discoveredSsids, newlyFound };
    }
}

export const provisioningScanner = new ProvisioningScanner();
export default ProvisioningScanner;
