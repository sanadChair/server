import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';
import logger from '#utils/logger.js';

const execAsync = promisify(exec);

// ─── Platform Adapters ────────────────────────────────────────────────────────

/**
 * Linux adapter using nmcli. Requires NetworkManager and appropriate polkit rules.
 */
const NmcliAdapter = {
    /**
     * @param {string} iface - e.g. "wlan1"
     * @returns {Promise<Array<{ ssid: string, signal: number }>>}
     */
    async scan(iface) {
        // Rescan first to get fresh data, then parse.
        await execAsync(`nmcli device wifi rescan ifname ${iface}`).catch(() => {});
        const { stdout } = await execAsync(
            `nmcli -t -f SSID,SIGNAL device wifi list ifname ${iface}`
        );
        return stdout
            .split('\n')
            .filter(Boolean)
            .map(line => {
                const [ssid, signal] = line.split(':');
                return { ssid: ssid?.trim(), signal: Number(signal) };
            })
            .filter(n => n.ssid);
    },

    /**
     * @param {string} iface
     * @param {string} ssid
     * @param {string} password
     */
    async connect(iface, ssid, password) {
        // Delete existing connection profile to avoid stale config conflicts.
        await execAsync(`nmcli connection delete "${ssid}"`).catch(() => {});
        await execAsync(
            `nmcli device wifi connect "${ssid}" password "${password}" ifname ${iface}`
        );
    },

    /** @param {string} iface */
    async disconnect(iface) {
        await execAsync(`nmcli device disconnect ${iface}`);
    },

    /** @param {string} iface @returns {Promise<string>} */
    async getAssignedIp(iface) {
        const { stdout } = await execAsync(
            `nmcli -g IP4.ADDRESS device show ${iface}`
        );
        // Output: "192.168.4.100/24"
        const ip = stdout.trim().split('/')[0];
        if (!ip) throw new Error(`[WIFI ADAPTER] Could not determine IP on ${iface}`);
        return ip;
    },
};

/**
 * Windows adapter using netsh. Requires a pre-created WLAN profile XML or
 * an existing profile with the matching SSID.
 *
 * Note: netsh cannot programmatically supply a password without a profile file.
 * For production Windows use, generate a profile XML and import it first.
 */
const NetshAdapter = {
    async scan(iface) {
        const { stdout } = await execAsync('netsh wlan show networks mode=bssid');
        const ssids = [...stdout.matchAll(/SSID\s+\d+\s+:\s+(.+)/g)].map(m => ({
            ssid: m[1].trim(),
            signal: 0,
        }));
        return ssids;
    },

    async connect(iface, ssid, password) {
        // Assumes a profile named after the SSID already exists.
        // In production, you'd generate and add the profile XML here.
        await execAsync(`netsh wlan connect name="${ssid}" ssid="${ssid}" interface="${iface}"`);
    },

    async disconnect(iface) {
        await execAsync(`netsh wlan disconnect interface="${iface}"`);
    },

    async getAssignedIp(iface) {
        const { stdout } = await execAsync(
            `netsh interface ip show address "${iface}"`
        );
        const match = stdout.match(/IP Address:\s+([\d.]+)/);
        if (!match) throw new Error(`[WIFI ADAPTER] Could not determine IP on ${iface}`);
        return match[1];
    },
};

// ─── Public Facade ────────────────────────────────────────────────────────────

const adapter = process.platform === 'win32' ? NetshAdapter : NmcliAdapter;

/**
 * Checks if the mock ESP32 simulator script is running by attempting to connect to its TCP port.
 * @returns {Promise<boolean>}
 */
function isMockEsp32Running() {
    return new Promise((resolve) => {
        const port = Number(process.env.PROVISIONING_HTTP_PORT) || 8080;
        const socket = net.connect({ port, host: '127.0.0.1', timeout: 200 }, () => {
            socket.end();
            resolve(true);
        });
        socket.on('error', () => {
            resolve(false);
        });
        socket.on('timeout', () => {
            socket.destroy();
            resolve(false);
        });
    });
}

let lastConnectedSsid = '';

const WifiAdapter = {
    /**
     * Scans for visible Wi-Fi networks on the dedicated provisioning interface.
     * Appends the mock device "smarthome_MOCK01" if the mock ESP32 script is running.
     *
     * @param {string} iface
     * @returns {Promise<Array<{ ssid: string, signal: number }>>}
     */
    async scanNetworks(iface) {
        logger.debug(`[WIFI ADAPTER] Scanning on ${iface}`);
        const networks = await adapter.scan(iface).catch(err => {
            logger.warn(`[WIFI ADAPTER] OS scan failed: ${err.message}. Returning empty list.`);
            return [];
        });

        // Only append the mock device to simulate its presence if the mock simulator script is running
        const isMockActive = await isMockEsp32Running();
        if (isMockActive) {
            networks.push({ ssid: 'smarthome_MOCK01', signal: 99 });
        }
        return networks;
    },

    /**
     * Connects the provisioning interface to a target SSID.
     * Bypasses the OS network manager if targeting a mock device.
     *
     * @param {string} iface
     * @param {string} ssid
     * @param {string} password
     */
    async connect(iface, ssid, password) {
        lastConnectedSsid = ssid;
        if (ssid.toUpperCase().includes('MOCK')) {
            logger.info(`[WIFI ADAPTER] [MOCK] Simulating connection to "${ssid}"`);
            return;
        }
        logger.info(`[WIFI ADAPTER] Connecting ${iface} → "${ssid}"`);
        await adapter.connect(iface, ssid, password);
        logger.info(`[WIFI ADAPTER] Connected to "${ssid}"`);
    },

    /**
     * Disconnects the provisioning interface.
     * Bypasses the OS network manager if the active connection was a mock.
     *
     * @param {string} iface
     */
    async disconnect(iface) {
        if (lastConnectedSsid.toUpperCase().includes('MOCK')) {
            logger.info(`[WIFI ADAPTER] [MOCK] Simulating disconnect from "${lastConnectedSsid}"`);
            lastConnectedSsid = '';
            return;
        }
        logger.info(`[WIFI ADAPTER] Disconnecting ${iface}`);
        await adapter.disconnect(iface).catch(err => {
            logger.warn(`[WIFI ADAPTER] Disconnect warning: ${err.message}`);
        });
        lastConnectedSsid = '';
    },

    /**
     * Returns the IP address assigned to the provisioning interface.
     * Returns 127.0.0.1 for simulated mock connections.
     *
     * @param {string} iface
     * @returns {Promise<string>}
     */
    async getAssignedIp(iface) {
        if (lastConnectedSsid.toUpperCase().includes('MOCK')) {
            return '127.0.0.1';
        }
        return adapter.getAssignedIp(iface);
    },
};

export default WifiAdapter;
