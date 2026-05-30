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

    async discoverDevices(timeoutMs = 400) {
        const discoveredDevices = await localDiscovery.discoverDevices(timeoutMs);
        await this.discoverNewDevice(discoveredDevices);
        // Detect disconnected devices
        await this.discoverDeletedDevices(discoveredDevices);
        return smartHomeDevicesDB.getAllDevices();
    }

    async getDevInfo(id) {
        const device = smartHomeDevicesDB.getDevice(id);
        if (!device)
            throw new Error(`device doesn't currently exist on the network`);
        const response = await fetch(`http://${device.ip}:${SMART_DEV_PORT}/info?id=${id}`);
        const data = await response.json();
        return { ...device, ...data };
    }

    validateState(state, control_type) {
        switch (control_type) {
            case 'binary':
                if (Number(state) === 0 || Number(state) === 1) return Number(state);
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
        await fetch(`http://${device.ip}:${SMART_DEV_PORT}/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ state, id }),
        });

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
            throw new Error(`trying to register a device that already exists device ID: ${device_id}`);
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
            await fetch(`http://${existingDevice.ip}:${SMART_DEV_PORT}/name`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    id: device.id,
                    name: device.name,
                }),
            });
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
            const response = await fetch(
                `http://${device.ip}:${SMART_DEV_PORT}/factoryReset?id=${id}`,
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
