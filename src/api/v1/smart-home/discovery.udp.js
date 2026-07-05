import dgram from 'dgram';
import process from 'process';
import broadcastAddress from '#utils/broadcast-interfaces.js';
import logger from '../../../utils/logger.js';
import 'dotenv/config';

const BROADCAST_IP = broadcastAddress.broadcast;
const BROADCAST_PORT = process.env.BROADCAST_PORT || 9988;

console.log('broadcast IP: ', BROADCAST_IP);
class LocalDiscovery {
    constructor() {
        this.udpSender = dgram.createSocket({ type: 'udp4', reuseAddr: true });
        this.requestId = 0;
        this.activeRequestId;
        this.devices = {};
        this.startServer();
        this.listenToBroadcastResponses(this.udpSender);
    }

    async getDevices() {
        await this.discoverDevices();
        return this.devices;
    }

    listenToBroadcastResponses(socketObj) {
        socketObj.on('message', (msg, rinfo) => {
            let payload;
            try {
                payload = JSON.parse(msg.toString());
            } catch {
                return;
            }
            logger.info(`[SERVER-DISCOVERY] recieved a response`);
            if (payload?.type !== 'discovery:response') return;
            logger.info(`[SERVER-DISCOVERY] PASSING type check`);
            if (payload?.requestId !== this.activeRequestId) return;
            logger.info(`[SERVER-DISCOVERY] PASSING Request id check`);
            if (!payload?.deviceId) return;
            logger.info(`[SERVER-DISCOVERY] PASSING deviceId check`);
            delete payload.type;
            delete payload.requestId;
            this.devices[payload.deviceId] = {
                id: payload.deviceId,
                name: payload.name,
                control_type: payload.control_type,
                state: payload.state,
                ip: rinfo.address || payload.ip,
                port: payload.port,
            };
        });
    }

    startServer() {
        this.udpSender.bind(BROADCAST_PORT, () => {
            this.udpSender.setBroadcast(true);
        });
    }

    discoverDevices(timeoutMs = 4000) {
        this.devices = {};
        const requestId = this.requestId++;
        this.activeRequestId = requestId;
        this.sendBroadcastWithIDs(requestId);

        return new Promise(resolve => {
            setTimeout(() => resolve({ ...this.devices }), timeoutMs);
        });
    }

    sendBroadcastWithIDs(requestId) {
        const payload = Buffer.from(
            JSON.stringify({
                type: 'discovery',
                requestId,
            })
        );
        console.log(`sending broadcasts through: ${BROADCAST_PORT}, ${BROADCAST_IP}`);
        this.udpSender.send(payload, 0, payload.length, BROADCAST_PORT, BROADCAST_IP);
    }
}

export const localDiscovery = new LocalDiscovery();
