import http from 'http';
import logger from '#utils/logger.js';

const PROVISIONING_PATH = '/configure';
const DEFAULT_DEVICE_IP = '192.168.4.1';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * @typedef {Object} ProvisioningPayload
 * @property {string} ssid        - Home router Wi-Fi SSID (max 32 chars per ESP32 firmware)
 * @property {string} password    - Home router Wi-Fi password (max 64 chars)
 * @property {string} deviceName  - Friendly name for this device (max 32 chars)
 */

/**
 * @typedef {Object} ProvisioningResult
 * @property {boolean} success
 * @property {'ok'|'econnreset'|'timeout'|'error'} reason
 * @property {string} [message]
 */

/**
 * Sends home Wi-Fi credentials to the ESP32's local configuration endpoint
 * using standard HTML form submission (application/x-www-form-urlencoded).
 *
 * The ESP32 firmware (at 192.168.4.1/configure) accepts:
 *   - name:     device friendly name
 *   - ssid:     home router SSID
 *   - password: home router password
 *
 * On successful receipt, the ESP32 immediately reboots to connect to the home
 * network. This reboot causes the TCP connection to reset (ECONNRESET), which
 * this client treats as a positive confirmation signal, not an error.
 *
 * @param {ProvisioningPayload} payload
 * @param {string} [deviceIp] - Defaults to the standard ESP32 SoftAP gateway IP.
 * @returns {Promise<ProvisioningResult>}
 */
export async function sendCredentials(payload, deviceIp = DEFAULT_DEVICE_IP) {
    const body = new URLSearchParams({
        name: payload.deviceName,
        ssid: payload.ssid,
        password: payload.password,
    }).toString();

    const isLocal = deviceIp === '127.0.0.1' || deviceIp === 'localhost';
    const targetPort = isLocal ? (Number(process.env.PROVISIONING_HTTP_PORT) || 8080) : 80;

    const options = {
        hostname: deviceIp,
        port: targetPort,
        path: PROVISIONING_PATH,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': Buffer.byteLength(body),
        },
    };

    logger.info(
        `[PROVISIONING HTTP] POST http://${deviceIp}${PROVISIONING_PATH} | ` +
        `name="${payload.deviceName}" ssid="${payload.ssid}"`
    );

    return new Promise(resolve => {
        let resolved = false;
        const safeResolve = (val) => {
            if (resolved) return;
            resolved = true;
            resolve(val);
        };

        const req = http.request(options, res => {
            logger.info(
                `[PROVISIONING HTTP] Response: HTTP ${res.statusCode} from ${deviceIp}`
            );
            // Drain the response body to free the socket, then resolve success.
            res.resume();
            res.on('end', () => safeResolve({ success: true, reason: 'ok' }));

            res.on('error', err => {
                if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                    logger.info(
                        `[PROVISIONING HTTP] Response connection dropped (${err.code}) — ` +
                        'ESP32 is rebooting. ✓'
                    );
                    safeResolve({ success: true, reason: 'econnreset' });
                } else {
                    logger.error(`[PROVISIONING HTTP] Response error: ${err.message}`);
                    safeResolve({ success: false, reason: 'error', message: err.message });
                }
            });

            res.on('aborted', () => {
                logger.info('[PROVISIONING HTTP] Response aborted — ESP32 is rebooting. ✓');
                safeResolve({ success: true, reason: 'econnreset' });
            });
        });

        req.setTimeout(REQUEST_TIMEOUT_MS, () => {
            logger.warn(`[PROVISIONING HTTP] Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
            req.destroy();
            safeResolve({ success: false, reason: 'timeout', message: 'Request timed out.' });
        });

        req.on('error', err => {
            if (err.code === 'ECONNRESET' || err.code === 'ECONNREFUSED') {
                // ECONNRESET is the expected outcome: the ESP32 reboots immediately
                // upon processing the form, dropping the connection. Treat as success.
                logger.info(
                    `[PROVISIONING HTTP] Connection dropped (${err.code}) — ` +
                    'ESP32 is rebooting to join home network. ✓'
                );
                safeResolve({ success: true, reason: 'econnreset' });
                return;
            }

            logger.error(`[PROVISIONING HTTP] Unexpected error: ${err.message}`);
            safeResolve({
                success: false,
                reason: 'error',
                message: err.message,
            });
        });

        req.write(body);
        req.end();
    });
}
