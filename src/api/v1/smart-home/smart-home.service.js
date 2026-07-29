import { localDiscovery } from './discovery.udp.js';
import { smartHomeDB } from './smart-home.db.js';
import logger from '#utils/logger.js';
import smartHomeRosTopic from './ros/smart-home.ros.topic.js';
import roomRosTopic from './ros/room.ros.topic.js';
import goalRosAction from '../goal/ros/goal.ros.action.js';

const SMART_DEV_PORT = process.env.SMART_DEV_PORT;

class SmartHomeService {
    // ==================== Init ====================
    async init() {
        // No separate init needed; DB is ready via TypeORM
    }

    // ==================== Discovery ====================
    async discoverNewDevice(discoveredDevices) {
        for (const [id, device] of Object.entries(discoveredDevices)) {
            const existing = await smartHomeDB.getDevice(id);
            if (!existing) {
                const deviceToStore = { ...device, connected: true };
                const savedDevice = await smartHomeDB.saveDevice(deviceToStore);
                logger.info(`[SMART HOME] New device discovered: ${id}`);
                smartHomeRosTopic.publishDeviceEvent('NEW_DEVICE', savedDevice);
                continue;
            }

            await smartHomeDB.updateDeviceInfo({
                ...device,
                id,
                connected: true,
            });
        }
    }

    async discoverDeletedDevices(discoveredDevices) {
        const devices = await smartHomeDB.getAllDevices();
        for (const [id, device] of Object.entries(devices)) {
            if (!discoveredDevices[id]) {
                if (device.connected !== false) {
                    const updatedDevice = await smartHomeDB.updateDeviceInfo({
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
        await this.discoverDeletedDevices(discoveredDevices);
        return smartHomeDB.getAllDevices();
    }

    // ==================== Device Management ====================

    async getDevInfo(id) {
        const device = await smartHomeDB.getDevice(id);
        if (!device) throw new Error(`device doesn't currently exist on the network`);
        if (device.connected === false) throw new Error(`device ${id} isn't connected to network`);

        const response = await fetch(`http://${device.ip}:${SMART_DEV_PORT}/info?deviceId=${id}`);
        const data = await response.json();
        if (response.error) throw new Error(`${response.error}`);
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
        const device = await smartHomeDB.getDevice(id);
        if (!device) return false;
        if (device.connected === false) throw new Error(`device ${id} isn't connected to network`);

        state = this.validateState(state, device.control_type);
        const res = await fetch(`http://${device.ip}:${SMART_DEV_PORT}/control`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ state, deviceId: id }),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data?.error);
        const updatedDevice = await smartHomeDB.updateDeviceState(id, state);
        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }

    async getAllDevices() {
        return smartHomeDB.getAllDevices();
    }

    async getDevice(id) {
        return smartHomeDB.getDevice(id);
    }

    async addDevice(device, room) {
        const device_id = device.deviceId ?? device.id;
        const existing = await smartHomeDB.getDevice(device_id);
        if (existing) {
            logger.warn(`[SMART HOME] device ${device_id} already exist`);
            throw new Error(
                `trying to register a device that already exists device ID: ${device_id}`
            );
        }
        this.validateState(device.state, device.control_type);

        let roomRef = null;
        if (room?.id) {
            roomRef = await smartHomeDB.getRoom(room.id);
            if (!roomRef) throw new Error(`room ${room.id} doesn't exist`);
        } else if (room?.name) {
            const rooms = await smartHomeDB.getAllRooms();
            roomRef = Object.values(rooms).find(r => r.name === room.name);
            if (!roomRef) throw new Error(`room ${room.name} doesn't exist`);
        }

        const savedDevice = await smartHomeDB.saveDevice(device, roomRef);
        smartHomeRosTopic.publishDeviceEvent('ADD', savedDevice);
        return savedDevice;
    }

    async updateDevice(device) {
        const existingDevice = await smartHomeDB.getDevice(device.id);
        if (!existingDevice) {
            logger.warn(`[SMART HOME] device doesn't exist or undefined`);
            throw new Error(`trying to update a device that doesn't exit ${device.id}`);
        }
        if (!device.name) throw new Error(`device new name isn't provided`);
        if (device.connected === false) throw new Error(`device ${device.id} isn't connected to network`);

        const res = await fetch(`http://${existingDevice.ip}:${SMART_DEV_PORT}/name`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                deviceId: device.id,
                name: device.name,
            }),
        });
        const data = await res.json();
        if (data?.error) throw new Error(data?.error);
        const updatedDevice = await smartHomeDB.updateDeviceInfo(device);
        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }

    async deleteDevice(id) {
        const device = await smartHomeDB.getDevice(id);
        if (!id || !device) {
            logger.warn(`[SMART HOME] device ${id} doesn't exist`);
            throw new Error(`trying to delete device that doesn't exist device id: ${id}`);
        }

        if (device.connected === false) throw new Error(`device ${id} isn't connected to network`);
        const res = await fetch(`http://${device.ip}:${SMART_DEV_PORT}/factoryReset?deviceId=${id}`, {
            method: 'DELETE',
        });
        const data = await res.json();
        if (data?.error) throw new Error(data?.error);
        await smartHomeDB.deleteDevice(id);
        smartHomeRosTopic.publishDeviceEvent('DISCONNECTED', id);
        return {
            id: data.deviceId,
            state: data.state,
        };
    }

    async changeDeviceRoom({ id, roomId }) {
        const existingDevice = await smartHomeDB.getDevice(id);
        if (!existingDevice) {
            logger.warn(`[SMART HOME] device ${id} doesn't exist`);
            throw new Error(
                `trying to update room for a device that doesn't exist device id: ${id}`
            );
        }

        const updatedDevice = await smartHomeDB.updateDeviceRoom(id, roomId);
        smartHomeRosTopic.publishDeviceEvent('UPDATE', updatedDevice);
        return updatedDevice;
    }

    // ==================== Room Management ====================

    async getAllRooms() {
        return smartHomeDB.getAllRooms();
    }

    async getRoom(id) {
        return smartHomeDB.getRoom(id);
    }

    async registerRoom(room) {
        const rooms = await smartHomeDB.getAllRooms();
        if (room.id && rooms[room.id]) {
            logger.warn(`[ROOM] room ${room.id} already exists`);
            throw new Error(`trying to register a room that already exists room id: ${room.id}`);
        }

        const existsByName = await smartHomeDB.roomExistsByName(room.name);
        if (existsByName) {
            logger.warn(`[ROOM] room ${room.name} already exists`);
            throw new Error(`trying to register a room that already exists room name: ${room.name}`);
        }

        const savedRoom = await smartHomeDB.saveRoom(room);
        roomRosTopic.publishRoomEvent('NEW_ROOM', savedRoom);
        return savedRoom;
    }

    async updateRoom(data) {
        const hasRoom = await smartHomeDB.hasRoom(data.id);
        if (!hasRoom) {
            logger.warn(`[ROOM] room doesn't exist or undefined`);
            throw new Error(`trying to update a room that doesn't exist ${data.id}`);
        }

        const updatedRoom = await smartHomeDB.updateRoom(data);
        roomRosTopic.publishRoomEvent('UPDATE', updatedRoom);
        return updatedRoom;
    }

    async deleteRoom(id) {
        const hasRoom = await smartHomeDB.hasRoom(id);
        if (!id || !hasRoom) {
            logger.warn(`[ROOM] room ${id} doesn't exist`);
            throw new Error(`trying to delete room that doesn't exist room id: ${id}`);
        }

        await smartHomeDB.deleteRoom(id);
        roomRosTopic.publishRoomEvent('DELETED', { id });
        return;
    }

    async navigateToRoom(id) {
        const room = await smartHomeDB.getRoom(id);
        if (!room) {
            throw new Error(`room ${id} doesn't exist`);
        }

        const poseMessage = {
            pose: {
                header: {
                    frame_id: 'map',
                },
                pose: {
                    position: {
                        x: room.pose_x,
                        y: room.pose_y,
                        z: 0.0,
                    },
                    orientation: {
                        x: 0.0,
                        y: 0.0,
                        z: Math.sin(room.pose_theta / 2),
                        w: Math.cos(room.pose_theta / 2),
                    },
                },
            },
        };

        const goalId = goalRosAction.executeGoal(poseMessage);
        return { success: true, message: `Navigating to room ${id}` };
    }
}

export const smartHomeService = new SmartHomeService();
export default SmartHomeService;
