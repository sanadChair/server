import { IRService } from './ir.service.js';

export class IRController {
    static async getDevice(req, res) {
        return await IRService.getDevice(req.query.deviceName);
    }

    static async getAllDevices(req, res) {
        return await IRService.getAllDevices();
    }

    static async createDevice(req, res) {
        return await IRService.createDevice(req.body);
    }

    static async deleteDevice(req, res) {
        return await IRService.deleteDevice(req.query.deviceName);
    }

    static async updateDeviceKeys(req, res) {
        return await IRService.updateDeviceKeys(req.body.deviceName, req.body.keys);
    }

    static async listenToKeys(req, res) {
        return await IRService.listenToKeys(req.body.deviceName, req.body.keyName, req.body.timeoutMs);
    }
}
