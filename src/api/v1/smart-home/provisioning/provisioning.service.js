import logger from '#utils/logger.js';
import WifiAdapter from './provisioning.wifi-adapter.js';
import { derivePassword } from './provisioning.crypto.js';
import { sendCredentials } from './provisioning.http-client.js';
import { provisioningScanner } from './provisioning.scanner.js';
import { smartHomeService } from '../smart-home.service.js';
import { smartHomeDevicesDB } from '../smart-home.db.js';

const IFACE = process.env.PROVISIONING_INTERFACE || 'wlan1';
const IS_MOCK_MODE = process.env.MOCK_MODE === 'true';

/**
 * Home Wi-Fi credentials — set exclusively through the API (POST /provisioning/wifi).
 * Not loaded from environment variables; the user must configure them before
 * any provisioning attempt can succeed.
 *
 * @type {{ ssid: string, password: string } | null}
 */
let homeWifiConfig = null;

class ProvisioningService {
    constructor() {
        this._isProcessing = false;
    }

    async init() {
        // No background work on startup — scans are triggered on demand via API.
        logger.info('[PROVISIONING SERVICE] Ready. Awaiting manual scan trigger.');
    }

    // ─── Home Wi-Fi Config ────────────────────────────────────────────────────

    /**
     * @returns {{ ssid: string, password: string } | null}
     */
    getHomeWifiConfig() {
        return homeWifiConfig ? { ...homeWifiConfig } : null;
    }

    /**
     * Stores the home router credentials used during provisioning.
     * Must be called before any device is targeted.
     * @param {{ ssid: string, password: string }} config
     */
    setHomeWifiConfig(config) {
        homeWifiConfig = { ssid: config.ssid, password: config.password };
        logger.info(`[PROVISIONING SERVICE] Home Wi-Fi configured: SSID="${config.ssid}"`);
    }

    // ─── Scan ─────────────────────────────────────────────────────────────────

    /**
     * Runs a single on-demand Wi-Fi scan and returns discovered smarthome SSIDs.
     * @returns {Promise<{ discovered: string[], newlyFound: string[] }>}
     */
    async performScan() {
        return provisioningScanner.scan();
    }

    // ─── Status ───────────────────────────────────────────────────────────────

    /**
     * @returns {{
     *   isScanning: boolean,
     *   isProcessing: boolean,
     *   queueSize: number,
     *   queuedSsids: string[],
     *   discoveredSsids: string[],
     *   homeWifiConfigured: boolean
     * }}
     */
    getStatus() {
        return {
            isScanning: provisioningScanner.isScanning,
            isProcessing: this._isProcessing,
            queueSize: 0,
            queuedSsids: [],
            discoveredSsids: provisioningScanner.discoveredSsids,
            homeWifiConfigured: homeWifiConfig !== null,
        };
    }

    // ─── Provisioning ─────────────────────────────────────────────────────────

    /**
     * Discovery-First entry point. Validates that the requested MAC is in the
     * discovered list and that home Wi-Fi credentials have been configured.
     *
     * @param {{ macAddress: string, deviceName: string, roomId?: string }} options
     */
    enqueueTarget({ macAddress, deviceName, roomId, controlType }) {
        if (!homeWifiConfig) {
            throw Object.assign(
                new Error(
                    'Home Wi-Fi credentials are not configured. ' +
                    'Call POST /smart-home/provisioning/wifi first.'
                ),
                { statusCode: 400 }
            );
        }

        const ssid = `smarthome_${macAddress}`;

        if (!provisioningScanner.discoveredSsids.includes(ssid)) {
            throw Object.assign(
                new Error(
                    `Device "${ssid}" is not in the discovered list. ` +
                    'Run POST /smart-home/provisioning/scan first.'
                ),
                { statusCode: 404 }
            );
        }

        if (this._isProcessing) {
            throw Object.assign(
                new Error('A provisioning task is already in progress. Please wait.'),
                { statusCode: 409 }
            );
        }

        // Start provisioning in the background
        this._provisionDevice({ ssid, macAddress, deviceName, roomId, controlType }).catch(err => {
            logger.error(`[PROVISIONING SERVICE] Provisioning failed: ${err.message}`);
        });

        logger.info(
            `[PROVISIONING SERVICE] Started direct provisioning for "${ssid}" as "${deviceName}" (${controlType}).`
        );
    }

    /**
     * Executes the full provisioning sequence for one device.
     * Always disconnects on completion, even on failure.
     *
     * @param {{ ssid: string, macAddress: string, deviceName: string, roomId?: string, controlType?: string }} target
     */
    async _provisionDevice({ ssid, macAddress, deviceName, roomId, controlType }) {
        logger.info(`[PROVISIONING SERVICE] ▶ Starting provisioning for "${ssid}"`);
        this._isProcessing = true;
        const password = derivePassword(macAddress);
        let connected = false;

        try {
            await WifiAdapter.connect(IFACE, ssid, password);
            connected = true;

            const deviceIp = await WifiAdapter.getAssignedIp(IFACE);

            const result = await sendCredentials(
                {
                    deviceName,
                    ssid: homeWifiConfig.ssid,
                    password: homeWifiConfig.password,
                },
                deviceIp
            );

            if (!result.success) {
                throw new Error(`HTTP client failed: ${result.message}`);
            }

            logger.info(`[PROVISIONING SERVICE] ✓ Credentials delivered to "${ssid}".`);
            provisioningScanner.markProvisioned(ssid);

            try {
                const existing = smartHomeService.getDevice(macAddress);
                if (existing) {
                    await smartHomeDevicesDB.updateDeviceInfo({
                        id: macAddress,
                        name: deviceName,
                        control_type: controlType || 'binary',
                        room: roomId ? { id: roomId } : null,
                    });
                    logger.info(`[PROVISIONING SERVICE] Device "${macAddress}" updated in DB.`);
                } else {
                    await smartHomeService.addDevice(
                        {
                            id: macAddress,
                            name: deviceName,
                            control_type: controlType || 'binary',
                            state: 0,
                            connected: false,
                        },
                        roomId ? { id: roomId } : undefined
                    );
                    logger.info(`[PROVISIONING SERVICE] Device "${macAddress}" registered in DB.`);
                }
            } catch (regErr) {
                logger.error(`[PROVISIONING SERVICE] DB registration/update failed: ${regErr.message}`);
            }
        } catch (err) {
            logger.error(`[PROVISIONING SERVICE] ✗ Failed: ${err.message}`);
        } finally {
            if (connected) {
                await WifiAdapter.disconnect(IFACE);
            }
            this._isProcessing = false;
            logger.info(`[PROVISIONING SERVICE] ◀ Finished task for "${ssid}".`);
        }
    }
}

export const provisioningService = new ProvisioningService();
export default ProvisioningService;
