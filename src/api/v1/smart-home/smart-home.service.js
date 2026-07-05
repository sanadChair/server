import { localDiscovery } from './discovery.udp.js';
import { smartHomeDevicesDB } from './smart-home.db.js';
import logger from '#utils/logger.js';
import smartHomeRosTopic from './ros/smart-home.ros.topic.js';

const SMART_DEV_PORT = process.env.SMART_DEV_PORT;
class SmartHomeService {
    async init() {
        await smartHomeDevicesDB.initializeDB();
    }

    async discoverNewDevice(discoveredDevices) {
        for (const [id, device] of Object.entries(discoveredDevices)) {
            if (!smartHomeDevicesDB.hasDevice(id)) {
                const deviceToStore = { ...device, connected: true };
                const savedDevice = await smartHomeDevicesDB.saveDevice(deviceToStore);
                logger.info(`[SMART HOME] New device discovered: ${id}`);
                smartHomeRosTopic.publishDeviceEvent('NEW_DEVICE', savedDevice);
                continue;
            }

            // Existing device: merge discovery data without overwriting stored metadata like position.
            await smartHomeDevicesDB.updateDeviceInfo({
                id,
                connected: true,
            });
        }
    }

    async discoverDeletedDevices(discoveredDevices) {
        const devices = smartHomeDevicesDB.getAllDevices();
        for (const [id, device] of Object.entries(devices)) {
            if (!discoveredDevices[id]) {
                // Device exists in DB but not currently discovered: mark as disconnected (do not delete).
                if (device.connected !== false) {
                    const updatedDevice = await smartHomeDevicesDB.updateDeviceInfo({
                        id,
                        connected: false,
                    });
                    logger.info(`[SMART HOME] Device disconnected: ${id}`);
                    smartHomeRosTopic.publishDeviceEvent('DISCONNECTED', updatedDevice);
                }
            }
        }
    }

    async addIptToInMemoryDevices(discoveredDevices) {
        const devices = smartHomeDevicesDB.getAllDevices();
        for (const [id, discoveredDevice] of Object.entries(discoveredDevices)) {
            if (!devices[id]) continue;

            devices[id].ip = discoveredDevice.ip;
            if (discoveredDevice.port !== undefined) {
                devices[id].port = discoveredDevice.port;
            }
        }
    }

    async discoverDevices(timeoutMs = 400) {
        const discoveredDevices = await localDiscovery.discoverDevices(timeoutMs);
        await this.discoverNewDevice(discoveredDevices);
        // Detect disconnected devices
        // console.log(discoveredDevices);
        await this.discoverDeletedDevices(discoveredDevices);
        await this.addIptToInMemoryDevices(discoveredDevices);
        return smartHomeDevicesDB.getAllDevices();
    }

    async getDevInfo(id) {
        const device = smartHomeDevicesDB.getDevice(id);
        if (!device) throw new Error(`device doesn't currently exist on the network`);

        console.log(device);
        try {
            const port = device.port || SMART_DEV_PORT || 80;
            const response = await fetch(`http://${device.ip}:${port}/info?id=${id}`);
            const data = await response.json();
            return { ...device, ...data };
        } catch (err) {
            logger.warn(`[SMART HOME] Failed to fetch info from device ${id}: ${err.message}`);
            return device;
        }
    }

    validateState(state, control_type) {
        const type = String(control_type || 'binary').split(':')[0];
        switch (type) {
            case 'binary':
                if (Number(state) === 0 || Number(state) === 1) return Number(state);
                else
                    throw new Error(
                        `state: ${state} doesn't match device control_type: ${control_type}`
                    );
            case 'dimmer':
            case 'slider':
            case 'range':
                const num = Number(state);
                if (!isNaN(num) && num >= 0 && num <= 100) return num;
                else
                    throw new Error(
                        `state: ${state} doesn't match device control_type: ${control_type}`
                    );
            default:
                throw new Error(`this device control_type is not implemented yet`);
        }
    }

    async controlDev(id, state) {
        const device = smartHomeDevicesDB.getDevice(id);
        if (!device) return false;

        state = this.validateState(state, device.control_type);
        try {
            const port = device.port || SMART_DEV_PORT || 80;
            await fetch(`http://${device.ip}:${port}/control`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ state, id }),
            });
        } catch (err) {
            logger.warn(`[SMART HOME] Failed to send control to device ${id}: ${err.message}`);
        }

        const updatedDevice = await smartHomeDevicesDB.updateDeviceState(id, state);

        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }

    getAllDevices() {
        return smartHomeDevicesDB.getAllDevices();
    }

    getDevice(id) {
        return smartHomeDevicesDB.getDevice(id);
    }

    async addDevice(device, room) {
        const device_id = device.deviceId ?? device.id;
        if (smartHomeDevicesDB.hasDevice(device_id)) {
            logger.warn(`[SMART HOME] device ${device_id} already exist`);
            throw new Error(
                `trying to register a device that already exists device ID: ${device_id}`
            );
        }
        this.validateState(device.state, device.control_type);
        const savedDevice = await smartHomeDevicesDB.saveDevice(device, room);
        smartHomeRosTopic.publishDeviceEvent('ADD', savedDevice);
        return savedDevice;
    }

    async updateDevice(device) {
        const existingDevice = smartHomeDevicesDB.getDevice(device.id);
        if (!existingDevice) {
            logger.warn(`[SMART HOME] device doesn't exist or undefined`);
            throw new Error(`trying to update a device that doesn't exit ${device.id}`);
        }
        if (device.name) {
            try {
                const port = existingDevice.port || SMART_DEV_PORT || 80;
                await fetch(`http://${existingDevice.ip}:${port}/name`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        id: device.id,
                        name: device.name,
                    }),
                });
            } catch (err) {
                logger.warn(`[SMART HOME] Failed to update name on device ${device.id}: ${err.message}`);
            }
        }
        const updatedDevice = await smartHomeDevicesDB.updateDeviceInfo(device);
        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }

    async deleteDevice(id) {
        const device = smartHomeDevicesDB.getDevice(id);
        if (!id || !device) {
            logger.warn(`[SMART HOME] device ${id} doesn't exist`);
            throw new Error(`trying to delete device that doesn't exist device id: ${id}`);
        }

        try {
            const port = device.port || SMART_DEV_PORT || 80;
            const response = await fetch(
                `http://${device.ip}:${port}/factoryReset?id=${id}`,
                {
                    method: 'DELETE',
                }
            );
            logger.info(`[SMART HOME] Factory reset sent to device ${id}: ${response.status}`);
        } catch (fetchErr) {
            logger.warn(`[SMART HOME] Failed to send factory reset to device ${id}:`, fetchErr);
        }

        await smartHomeDevicesDB.deleteDevice(id);
        smartHomeRosTopic.publishDeviceEvent('DISCONNECTED', id);
        return;
    }

    async changeDeviceRoom({ id, roomId }) {
        const existingDevice = smartHomeDevicesDB.getDevice(id);
        if (!existingDevice) {
            logger.warn(`[SMART HOME] device ${id} doesn't exist`);
            throw new Error(
                `trying to update room for a device that doesn't exist device id: ${id}`
            );
        }

        const updatedDevice = await smartHomeDevicesDB.updateRoom(id, roomId);

        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }
}

export const smartHomeService = new SmartHomeService();
export default SmartHomeService;
