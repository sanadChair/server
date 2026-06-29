import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import { IRService } from '../ir.service.js';

const mapToRosDevice = (dev = {}) => ({
    id: dev.id || '',
    device_name: dev.device_name || dev.deviceName || '',
    pose: JSON.stringify(dev.pose || {}),
    keys: JSON.stringify(dev.keys || {}),
    created_at: dev.created_at ? String(dev.created_at) : '',
    updated_at: dev.updated_at ? String(dev.updated_at) : '',
});

const parseJsonField = value => {
    if (!value || typeof value !== 'string') return value || {};

    try {
        return JSON.parse(value);
    } catch (error) {
        return {};
    }
};

const getDeviceName = req => req.deviceName || req.device_name || req.name || req.device?.device_name || req.device?.deviceName;

class IRROSService {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[IRROSService] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.createService();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.createService();
        }
    }

    createService() {
        this.getAllDevices = new ROSLIB.Service({
            ros: this.ros,
            name: '/ir/getAllDevices',
            serviceType: 'sanad_interfaces/ir/srv/GetAllDevices',
        });
        this.getAllDevices.advertise(this.getAllDevicesCallback.bind(this));

        this.getDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/ir/getDevice',
            serviceType: 'sanad_interfaces/ir/srv/GetDevice',
        });
        this.getDevice.advertise(this.getDeviceCallback.bind(this));

        this.createDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/ir/createDevice',
            serviceType: 'sanad_interfaces/ir/srv/CreateDevice',
        });
        this.createDevice.advertise(this.createDeviceCallback.bind(this));

        this.deleteDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/ir/deleteDevice',
            serviceType: 'sanad_interfaces/ir/srv/DeleteDevice',
        });
        this.deleteDevice.advertise(this.deleteDeviceCallback.bind(this));

        this.updateDeviceKeys = new ROSLIB.Service({
            ros: this.ros,
            name: '/ir/updateDeviceKeys',
            serviceType: 'sanad_interfaces/ir/srv/UpdateDeviceKeys',
        });
        this.updateDeviceKeys.advertise(this.updateDeviceKeysCallback.bind(this));
    }

    async getAllDevicesCallback(req, res) {
        const devices = await IRService.getAllDevices();
        res.devices = Object.values(devices || {}).map(mapToRosDevice);
        return true;
    }

    async getDeviceCallback(req, res) {
        try {
            const device = await IRService.getDevice(getDeviceName(req));
            res.device = mapToRosDevice(device);
        } catch (error) {
            logger.warn(`[IR ROS service] Failed to get device: ${error.message}`);
            res.device = mapToRosDevice({});
        }
        return true;
    }

    async createDeviceCallback(req, res) {
        const rosDevice = req.device || req;
        const device = {
            deviceName: getDeviceName(req),
            pose: parseJsonField(rosDevice.pose),
            keys: parseJsonField(rosDevice.keys),
        };

        try {
            await IRService.createDevice(device);
            res.success = true;
        } catch (error) {
            logger.warn(`[IR ROS service] Failed to create device: ${error.message}`);
            res.success = false;
        }
        return true;
    }

    async deleteDeviceCallback(req, res) {
        try {
            await IRService.deleteDevice(getDeviceName(req));
            res.success = true;
        } catch (error) {
            logger.warn(`[IR ROS service] Failed to delete device: ${error.message}`);
            res.success = false;
        }
        return true;
    }

    async updateDeviceKeysCallback(req, res) {
        try {
            await IRService.updateDeviceKeys(getDeviceName(req), parseJsonField(req.keys));
            res.success = true;
        } catch (error) {
            logger.warn(`[IR ROS service] Failed to update device keys: ${error.message}`);
            res.success = false;
        }
        return true;
    }
}

export default new IRROSService();
