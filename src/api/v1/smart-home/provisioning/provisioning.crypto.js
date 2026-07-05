import crypto from 'crypto';
import 'dotenv/config';

const SSID_PREFIX = 'smarthome_';

/**
 * Parses the MAC address segment from a smarthome SSID.
 * @param {string} ssid - e.g. "smarthome_A4CF11"
 * @returns {string|null} The MAC portion (e.g. "A4CF11") or null if not a valid SSID.
 */
export function parseMacFromSsid(ssid) {
    if (typeof ssid !== 'string') return null;
    if (!ssid.toLowerCase().startsWith(SSID_PREFIX.toLowerCase())) return null;
    const mac = ssid.slice(SSID_PREFIX.length).trim();
    return mac.length > 0 ? mac : null;
}

/**
 * Derives the ESP32 SoftAP Wi-Fi connection password from its MAC address using HMAC-SHA256.
 *
 * ⚠ Security note: The returned 12-character string is used ONLY as the Wi-Fi AP password.
 *   It is NOT a valid AES key (AES-256 requires a full 32-byte buffer) and must never be
 *   repurposed as one.
 *
 * @param {string} macAddress - The MAC segment extracted from the SSID (e.g. "A4CF11").
 * @returns {string} A 12-character lowercase hex string used as the SoftAP connection password.
 * @throws {Error} If PROVISIONING_SALT is not configured in the environment.
 */
export function derivePassword(macAddress) {
    const salt = process.env.PROVISIONING_SALT;
    if (!salt) {
        throw new Error('[PROVISIONING] PROVISIONING_SALT env var is not configured.');
    }
    return crypto
        .createHmac('sha256', salt)
        .update(macAddress.toUpperCase())
        .digest('hex')
        .substring(0, 12);
}
