import { provisioningService } from './provisioning.service.js';

/**
 * GET /smart-home/provisioning/status
 *
 * Returns the current provisioning system snapshot:
 *   - homeWifiConfigured: whether POST /wifi has been called yet
 *   - isScanning:         true while POST /scan is running
 *   - discoveredSsids:    unprovisioned smarthome devices from the last scan
 *   - isProcessing:       true while a device is being provisioned
 *   - queuedSsids:        devices waiting in the provisioning queue
 *   - queueSize:          number of devices pending (excludes the active one)
 */
export function getProvisioningStatus(req, res, next) {
    return provisioningService.getStatus();
}

/**
 * GET /smart-home/provisioning/discover
 *
 * Triggers a single on-demand Wi-Fi scan on the dedicated provisioning interface.
 * Filters results to SSIDs matching `smarthome_[MAC]`. Returns a list of structured
 * device objects that the frontend can present for registration/provisioning.
 *
 * Returns 409 if a scan is already in progress.
 */
export async function discoverUnprovisioned(req, res, next) {
    const scanResult = await provisioningService.performScan();
    // Map SSIDs to structured device objects
    const devices = scanResult.discovered.map(ssid => {
        const parts = ssid.split('_');
        const macAddress = parts[1] || ssid;
        return {
            id: macAddress,
            macAddress,
            ssid,
            name: ssid,
        };
    });
    return devices;
}

/**
 * POST /smart-home/provisioning/wifi
 *
 * Sets the home router Wi-Fi credentials used when provisioning new devices.
 * This must be called before any device can be targeted for provisioning.
 * Credentials are held in memory only — they are not persisted to disk.
 *
 * Body: { ssid: string, password: string }
 */
export function setHomeWifi(req, res, next) {
    const { ssid, password } = req.body;
    provisioningService.setHomeWifiConfig({ ssid, password });
    return { configured: true, ssid };
}

/**
 * POST /smart-home/provisioning/target
 *
 * Discovery-First entry point.
 * Enqueues a specific discovered device for provisioning.
 *
 * Prerequisites (enforced server-side with 400/404 errors):
 *   1. POST /wifi must have been called first.
 *   2. The macAddress must appear in the last scan results (GET /status → discoveredSsids).
 *
 * Returns immediately. Provisioning runs in the background queue.
 * Poll GET /status for progress.
 *
 * Body: { macAddress: string, deviceName: string, roomId?: string }
 */
export function targetDevice(req, res, next) {
    const { macAddress, deviceName, roomId, controlType } = req.body;
    provisioningService.enqueueTarget({ macAddress, deviceName, roomId, controlType });
    return {
        queued: true,
        macAddress,
        deviceName,
        message: `smarthome_${macAddress} added to the provisioning queue.`,
    };
}
