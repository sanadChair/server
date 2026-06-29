import { irdb } from './ir.db.js';

export class IRService {
    static async getDevice(deviceName) {
        const device = await irdb.getDeviceByName(deviceName);
        if (device) return device;
        else throw new Error(`no device found with name ${deviceName}`);
    }

    static async getAllDevices() {
        return await irdb.getAllDevices();
    }

    static async createDevice(device) {
        const oldDev = await irdb.getDeviceByName(device.deviceName);
        if (oldDev) throw new Error(`device already exist with name = ${device.deviceName}!`);
        return await irdb.createDevice(device);
    }

    static async deleteDevice(deviceName) {
        return await irdb.deleteDevice(deviceName);
    }

    static async updateDeviceKeys(deviceName, keys) {
        const oldDev = await irdb.getDeviceByName(deviceName);
        if (!oldDev) throw new Error(`couldn't find a device with name: ${deviceName}`);
        const fullKeys = {
            ...oldDev.keys,
            ...keys,
        };
        return await irdb.updateKeys(deviceName, fullKeys);
    }

    static async listenToKeys(deviceName, keyName) {
        const dev = await irdb.getDeviceByName(deviceName);
				if (!dev) throw new Error(`no existing device with name: ${deviceName}`);
				ros
    }
}
