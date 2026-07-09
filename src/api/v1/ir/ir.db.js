import { dbRepositories } from '#src/db/db.repositories.js';

class IRDB {
    get irDB() {
        return dbRepositories.ir;
    }
    async getAllDevices() {
        return await this.irDB.find({});
    }

    async getDeviceByName(name) {
        return await this.irDB.findOne({ where: { device_name: name } });
    }

    async createDevice(device) {
        return await this.irDB.insert({
            device_name: device.deviceName,
            pose: device.pose,
            keys: device.keys || {},
        });
    }

    async updateKeys(deviceName, deviceKeys) {
        return await this.irDB.update({ device_name: deviceName }, { keys: deviceKeys });
    }

    deleteDevice(deviceName) {
        return this.irDB.delete({ device_name: deviceName });
    }
}

export const irdb = new IRDB();
