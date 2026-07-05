/**
 * mock-esp32.js
 * =============
 * Self-contained ESP32 SoftAP provisioning simulator.
 * Zero external dependencies — uses only Node.js built-in modules.
 *
 * What this simulates
 * -------------------
 * 1. An ESP32 in factory mode: boots in SoftAP mode broadcasting SSID "smarthome_MOCK01"
 *    with a dynamically derived password.
 * 2. A lightweight web server at /configure mirroring the real ESP32 firmware interface:
 *    - GET  /configure → serves the HTML form
 *    - POST /configure → parses x-www-form-urlencoded body, validates fields, then
 *                        closes the server to simulate the ESP32 rebooting to join
 *                        the home Wi-Fi (which causes ECONNRESET on the server side).
 *
 * How to run
 * ----------
 *   node src/mocks/provisioning/mock-esp32.js
 *
 * Then in a second terminal, trigger provisioning via the main server:
 *   # 1. Check discovered devices
 *   curl http://localhost:5051/api/v1/smart-home/provisioning/status
 *
 *   # 2. Target the mock device
 *   curl -X POST http://localhost:5051/api/v1/smart-home/provisioning/target \
 *     -H "Content-Type: application/json" \
 *     -d '{"macAddress":"MOCK01","deviceName":"Test Lamp","roomId":"optional-uuid"}'
 *
 * Or test the form directly with curl:
 *   curl -X POST http://localhost:8080/configure \
 *     -H "Content-Type: application/x-www-form-urlencoded" \
 *     --data-urlencode "name=Test Lamp" \
 *     --data-urlencode "ssid=HomeNetwork" \
 *     --data-urlencode "password=secret123"
 */

import http from 'http';
import crypto from 'crypto';
import dgram from 'dgram';

// ─── Configuration ────────────────────────────────────────────────────────────

const MOCK_MAC = 'MOCK01';
const MOCK_SSID = `smarthome_${MOCK_MAC}`;
const MOCK_SALT = process.env.PROVISIONING_SALT || 'eb05bede7f049adbd2f6d9b49308ef90';
const PORT = Number(process.env.PROVISIONING_HTTP_PORT) || 8080;
const HOST = '0.0.0.0';

/** ESP32 firmware field length limits */
const LIMITS = {
    name: 32,
    ssid: 32,
    password: 64,
};

/** Delay (ms) before the mock "reboots" after receiving credentials */
const REBOOT_DELAY_MS = 500;

/** Delay (ms) to simulate connecting to the home Wi-Fi */
const WIFI_JOIN_DELAY_MS = 2000;

// ─── Password derivation (mirrors provisioning.crypto.js exactly) ─────────────

function derivePassword(macAddress) {
    return crypto
        .createHmac('sha256', MOCK_SALT)
        .update(macAddress.toUpperCase())
        .digest('hex')
        .substring(0, 12);
}

// ─── HTML form (mirrors real ESP32 firmware page) ────────────────────────────

const CONFIGURE_FORM_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartHome Device Setup</title>
  <style>
    body { font-family: sans-serif; max-width: 400px; margin: 40px auto; padding: 1rem; }
    h1   { font-size: 1.2rem; }
    label { display: block; margin-top: 1rem; font-weight: bold; }
    input { width: 100%; padding: .4rem; margin-top: .2rem; box-sizing: border-box; }
    button { margin-top: 1.5rem; padding: .5rem 1.5rem; }
    .device { font-size: .8rem; color: #666; margin-top: .5rem; }
  </style>
</head>
<body>
  <h1>Device Configuration</h1>
  <p class="device">Device ID: <strong>${MOCK_SSID}</strong></p>
  <form method="POST" action="/configure">
    <label for="name">Device Name</label>
    <input type="text" id="name" name="name" maxlength="32" required placeholder="e.g. Living Room Light">

    <label for="ssid">Home Wi-Fi SSID</label>
    <input type="text" id="ssid" name="ssid" maxlength="32" required placeholder="Your network name">

    <label for="password">Home Wi-Fi Password</label>
    <input type="password" id="password" name="password" maxlength="64" required placeholder="Your network password">

    <button type="submit">Configure &amp; Connect</button>
  </form>
</body>
</html>`;

// ─── Utilities ────────────────────────────────────────────────────────────────

function log(stage, message) {
    const ts = new Date().toISOString();
    console.log(`  ${ts}  [${stage.padEnd(22)}]  ${message}`);
}

/**
 * Reads the full body of an HTTP request as a string.
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

/**
 * Validates the parsed form fields against firmware length limits.
 * @param {{ name: string, ssid: string, password: string }} fields
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateFields(fields) {
    const errors = [];
    if (!fields.name) errors.push('`name` is required');
    if (!fields.ssid) errors.push('`ssid` is required');
    if (!fields.password) errors.push('`password` is required');

    if (fields.name?.length > LIMITS.name) errors.push(`\`name\` exceeds ${LIMITS.name} chars`);
    if (fields.ssid?.length > LIMITS.ssid) errors.push(`\`ssid\` exceeds ${LIMITS.ssid} chars`);
    if (fields.password?.length > LIMITS.password) errors.push(`\`password\` exceeds ${LIMITS.password} chars`);

    return { valid: errors.length === 0, errors };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const derivedPassword = derivePassword(MOCK_MAC);

let deviceName = '';
let deviceState = 0;
let controlType = 'binary';
let homeHttpServer = null;
let homeUdpSocket = null;
let softApServer = null;

function startSoftAPSimulation() {
    console.log('\n' + '═'.repeat(60));
    console.log('  mock-esp32.js  —  ESP32 SoftAP Provisioning Simulator');
    console.log('═'.repeat(60));
    log('AP Opened', `Broadcasting SSID : ${MOCK_SSID}`);
    log('AP Opened', `AP Password       : ${derivedPassword}  (HMAC-SHA256 derived)`);
    log('AP Opened', `Listening on      : http://${HOST}:${PORT}/configure`);
    log('AP Opened', `SALT used         : "${MOCK_SALT}"`);
    console.log('─'.repeat(60) + '\n');

    softApServer = http.createServer(async (req, res) => {
        const clientIp = req.socket.remoteAddress;

        // ── GET /configure — serve the HTML form ─────────────────────────────────
        if (req.method === 'GET' && req.url === '/configure') {
            log('Form Served', `GET /configure  ←  ${clientIp}`);
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(CONFIGURE_FORM_HTML);
            return;
        }

        // ── POST /configure — parse credentials and simulate provisioning ─────────
        if (req.method === 'POST' && req.url === '/configure') {
            log('Client Connected', `POST /configure  ←  ${clientIp}`);

            let rawBody;
            try {
                rawBody = await readBody(req);
            } catch (err) {
                log('ERROR', `Failed to read request body: ${err.message}`);
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
                return;
            }

            // Parse x-www-form-urlencoded using the native URLSearchParams API.
            const params = new URLSearchParams(rawBody);
            const fields = {
                name: params.get('name')?.trim() ?? '',
                ssid: params.get('ssid')?.trim() ?? '',
                password: params.get('password') ?? '',
            };

            log('Credentials Received', `name="${fields.name}"  ssid="${fields.ssid}"  password=${'*'.repeat(fields.password.length)}`);

            // ── Validate ──────────────────────────────────────────────────────────
            const { valid, errors } = validateFields(fields);

            if (!valid) {
                log('Validation FAILED', errors.join('; '));
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end(`Validation failed: ${errors.join(', ')}`);
                return;
            }

            log('Validation OK', 'All fields are within firmware limits.');

            // ── Acknowledge and simulate reboot ───────────────────────────────────
            // The real ESP32 saves credentials to NVS flash and immediately reboots,
            // which drops the TCP connection (ECONNRESET). We mirror that behavior:
            //   1. Send a minimal 200 OK (some firmware variants do this)
            //   2. Destroy the socket to trigger ECONNRESET on the provisioner
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('OK');

            setTimeout(() => {
                log('AP Closed', 'Credentials saved. Simulating ESP32 reboot — destroying socket.');

                // Force-close the socket to replicate ECONNRESET.
                req.socket.destroy();

                // Shut down the HTTP server (AP goes offline as device leaves SoftAP mode).
                softApServer.close(() => {
                    log('AP Closed', 'HTTP server stopped (SoftAP deactivated).');
                    softApServer = null;
                    simulateHomeWifiConnection(fields);
                });
            }, REBOOT_DELAY_MS);

            return;
        }

        // ── 404 for all other paths ───────────────────────────────────────────────
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });

    softApServer.on('error', err => {
        console.error(`\n[SERVER ERROR] ${err.message}`);
        process.exit(1);
    });

    softApServer.listen(PORT, HOST, () => {
        log('Waiting', `HTTP server ready — awaiting provisioner connection on port ${PORT}`);
    });
}

// ─── Post-provisioning simulation ────────────────────────────────────────────

function simulateHomeWifiConnection(fields) {
    deviceName = fields.name;
    
    console.log('\n' + '─'.repeat(60));
    log('Simulating Connection', `Connecting to home Wi-Fi: "${fields.ssid}"`);
    log('Simulating Connection', `Using password: ${'*'.repeat(fields.password.length)}`);

    setTimeout(() => {
        log('Done ✓', `Device "${deviceName}" (${MOCK_SSID}) successfully joined "${fields.ssid}".`);
        log('Done ✓', 'Device is now on the home network. UDP discovery will find it next cycle.');
        console.log('─'.repeat(60) + '\n');

        startHomeNetworkSimulation();
    }, WIFI_JOIN_DELAY_MS);
}

function startHomeNetworkSimulation() {
    log('Home Network', `Starting simulated device services on port ${PORT}...`);

    // 1. Start UDP Discovery Responder
    const udpPort = Number(process.env.BROADCAST_PORT) || 9988;
    homeUdpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    
    homeUdpSocket.on('message', (msg, rinfo) => {
        let payload;
        try {
            payload = JSON.parse(msg.toString());
        } catch {
            return;
        }

        if (payload?.type === 'discovery') {
            log('UDP Discovery', `Received scan request from ${rinfo.address}:${rinfo.port}`);
            const response = Buffer.from(
                JSON.stringify({
                    type: 'discovery:response',
                    requestId: payload.requestId,
                    id: MOCK_MAC,
                    deviceId: MOCK_MAC,
                    name: deviceName || MOCK_SSID,
                    control_type: controlType,
                    state: deviceState,
                    port: PORT,
                    ip: '127.0.0.1'
                })
            );
            homeUdpSocket.send(response, 0, response.length, rinfo.port, rinfo.address);
        }
    });

    homeUdpSocket.on('error', (err) => {
        log('UDP Error', err.message);
    });

    homeUdpSocket.bind(udpPort, () => {
        log('UDP Discovery', `Listening for discovery broadcasts on port ${udpPort}`);
    });

    // 2. Start HTTP Server for Control & Info
    homeHttpServer = http.createServer(async (req, res) => {
        const clientIp = req.socket.remoteAddress;

        // GET /info
        if (req.method === 'GET' && req.url.startsWith('/info')) {
            log('HTTP GET /info', `Info requested by ${clientIp}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                id: MOCK_MAC,
                deviceId: MOCK_MAC,
                name: deviceName,
                control_type: controlType,
                state: deviceState,
                connected: true
            }));
            return;
        }

        // POST /control
        if (req.method === 'POST' && req.url === '/control') {
            const body = await readBody(req);
            let payload;
            try {
                payload = JSON.parse(body);
            } catch {
                res.writeHead(400, { 'Content-Type': 'text/plain' });
                res.end('Bad Request');
                return;
            }

            if (payload.state !== undefined) {
                deviceState = Number(payload.state);
                log('HTTP POST /control', `State updated to: ${deviceState}`);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ status: 'success', state: deviceState }));
                return;
            }

            res.writeHead(400, { 'Content-Type': 'text/plain' });
            res.end('Missing state field');
            return;
        }

        // DELETE /factoryReset
        if (req.method === 'DELETE' && req.url.startsWith('/factoryReset')) {
            log('HTTP DELETE /factoryReset', `Factory reset triggered by ${clientIp}`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ status: 'success', message: 'Device reset' }));

            // Shutdown home network services and reboot to SoftAP mode
            setTimeout(() => {
                log('Rebooting', 'Shutting down home network services...');
                if (homeUdpSocket) {
                    homeUdpSocket.close();
                    homeUdpSocket = null;
                }
                if (homeHttpServer) {
                    homeHttpServer.close(() => {
                        log('Rebooting', 'HTTP server stopped.');
                        // Restart SoftAP mode
                        startSoftAPSimulation();
                    });
                    homeHttpServer = null;
                }
            }, 500);
            return;
        }

        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
    });

    homeHttpServer.listen(PORT, HOST, () => {
        log('Home Network', `HTTP server listening for commands on http://${HOST}:${PORT}`);
    });
}

// Start simulation on startup
startSoftAPSimulation();
