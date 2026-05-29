import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import { smartHomeService } from '../smart-home.service.js';

const mapToRosDevice = (dev = {}) => ({
    id: dev.id || '',
    name: dev.name || '',
    control_type: dev.control_type || '',
    state: Number(dev.state) || 0,
    connected: Boolean(dev.connected),
    created_at: dev.created_at ? String(dev.created_at) : '',
    updated_at: dev.updated_at ? String(dev.updated_at) : '',
});

class SmartHomeService {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[SmartHome] ROS reconnected, refreshing subscription...');
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
            name: '/smarthome/getAllDevices',
            serviceType: 'sanad_interfaces/srv/GetAllDevices',
        });
        this.getAllDevices.advertise(this.getAllDevicesCallback.bind(this));

        this.deleteDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/smarthome/deleteDevices',
            serviceType: 'sanad_interfaces/srv/DeleteDevice',
        });
        this.deleteDevice.advertise(this.deleteDeviceCallback.bind(this));

        this.getDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/smarthome/getDevices',
            serviceType: 'sanad_interfaces/srv/GetDevice',
        });
        this.getDevice.advertise(this.getDeviceCallback.bind(this));

        this.registerDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/smarthome/registerDevice',
            serviceType: 'sanad_interfaces/srv/RegisterDevice',
        });
        this.registerDevice.advertise(this.registerDeviceCallback.bind(this));

        this.controlDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/smarthome/controlDevice',
            serviceType: 'sanad_interfaces/srv/ControlDevice',
        });
        this.controlDevice.advertise(this.controlDeviceCallback.bind(this));

        this.moveDevice = new ROSLIB.Service({
            ros: this.ros,
            name: '/smarthome/moveDevice',
            serviceType: '/sanad_interfaces/srv/MoveDevice',
        });
        this.moveDevice.advertise(this.moveDeviceCallback.bind(this));
    }

    moveDeviceCallback(req, res) {
        const devices = smartHomeService.getAllDevices();
        if (!devices[req.device_id]) {
            logger.warn(
                `[Smart-home ROS service] Failed to move device (id=${req.device_id}): device doesn't exist`
            );
            res.success = false;
            return true;
        }
        smartHomeService.changeDeviceRoom({ id: req.device_id, roomId: req.room_id }).catch(error =>
            logger.warn(`[Smart-home ROS service] Failed to move device: ${error.message}`)
        );
        res.success = true;
        return true;
    }

    controlDeviceCallback(req, res) {
        const devices = smartHomeService.getAllDevices();
        if (!devices[req.id]) {
            logger.warn(
                `[Smart-home ROS service] Failed to update device (id=${req.id}): device doesn't exist`
            );
            res.success = false;
            return true;
        }
        smartHomeService
            .controlDev(req.id, req.state)
            .catch(error => {
                logger.warn(`[Smart-home ROS service] Failed to update device: ${error.message}`);
            });
        res.success = true;
        return true;
    }

    getAllDevicesCallback(req, res) {
        const devices = smartHomeService.getAllDevices();
        res.devices = Object.values(devices || {}).map(mapToRosDevice);
        return true;
    }

    async deleteDeviceCallback(req, res) {
        const devices = smartHomeService.getAllDevices();
        if (!devices[req.id]) {
            logger.warn(
                `[Smart-home ROS service] Failed to delete device (id=${req.id}): device doesn't exist`
            );
            res.success = false;
            return true;
        }
        smartHomeService
            .deleteDevice(req.id)
            .catch(error => {
                logger.warn(`[Smart-home ROS service] Failed to delete device: ${error.message}`);
            });
        res.success = true;
        return true;
    }

    getDeviceCallback(req, res) {
        const dev = smartHomeService.getDevice(req.id);
        res.device = dev ? mapToRosDevice(dev) : mapToRosDevice({});
        return true;
    }

    registerDeviceCallback(req, res) {
        const devMsg = req.device;
        const device = {
            id: devMsg.id,
            name: devMsg.name,
            control_type: devMsg.control_type,
            state: devMsg.state,
            connected: devMsg.connected,
            created_at: devMsg.created_at,
            updated_at: devMsg.updated_at,
        };
        const devices = smartHomeService.getAllDevices();
        if (devices[device.id]) {
            logger.warn(
                `[Smart-home ROS service] Failed to register device (id=${device.id}): device already exists`
            );
            res.success = false;
            return true;
        }
        smartHomeService
            .addDevice(device)
            .catch(error => {
                logger.warn(`[Smart-home ROS service] Failed to register device: ${error.message}`);
            });
        res.success = true;
        return true;
    }
}

export default new SmartHomeService();
