import logger from '#utils/logger.js';
import { dbRepositories } from '#src/db/db.repositories.js';
import { AppDataSource } from '#src/db/datasources.js';
import { roomDB } from '../room/room.db.js';

class SmartHomeDevicesDB {
    constructor() {
        this.devices;
    }

    get devicesDb() {
        return dbRepositories.device;
    }

    async initializeDB() {
        try {
            const devicesArr = await this.devicesDb.find({ relations: { room: true } });
            this.devices = {};
            for (const dev of devicesArr) {
                this.devices[dev.id] = {
                    ...dev,
                    state: 0,
                };
            }
            return this.devices;
        } catch (err) {
            if (!AppDataSource.isInitialized) {
                throw err;
            }
            logger.warn(`[SMART HOME DB] Failed to read DB, initializing empty: ${err.message}`);
            this.devices = {};
            return this.devices;
        }
    }

    getAllDevices() {
        if (this.devices) {
            return this.devices;
        }
        throw new Error(`devices DB wasnt initialized yet try restarting the server`);
    }

    getDevice(id) {
        const devices = this.getAllDevices();
        return devices[id];
    }

    hasDevice(id) {
        return Boolean(this.getDevice(id));
    }

    resolveCachedRoom(room) {
        if (!room) return null;

        const id = room.id ?? room.roomId;
        const name = room.name ?? room.roomName;

        if (!id && !name) return null;

        const rooms = roomDB.getAllRooms();
        const dbroom = id
            ? rooms[id]
            : Object.values(rooms).find(currentRoom => currentRoom.name === name);

        if (!dbroom) {
            throw new Error(`room ${id || name} doesn't exist`);
        }

        return dbroom;
    }

    toDeviceRecord(device, room) {
        const record = {
            id: device.deviceId ?? device.id,
            name: device.name,
            control_type: device.control_type ?? device.controlType,
            connected: device.connected ?? false,
        };

        if (room !== undefined) {
            record.room = room ? { id: room.id } : null;
        }

        return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
    }

    toMemoryDevice(device, previous = {}, room) {
        const id = device.deviceId ?? device.id ?? previous.id;
        const nextRoom = room !== undefined ? room : (device.room ?? previous.room);

        const memoryDevice = {
            ...previous,
            ...device,
            id,
            control_type: device.control_type ?? device.controlType ?? previous.control_type,
            connected: device.connected ?? previous.connected ?? false,
            state: device.state ?? previous.state ?? 0,
            ip: device.ip ?? previous.ip,
            room: nextRoom ?? null,
        };

        delete memoryDevice.deviceId;
        delete memoryDevice.controlType;
        delete memoryDevice.roomId;
        delete memoryDevice.roomName;

        return memoryDevice;
    }

    async saveDevice(device, room) {
        const devices = this.getAllDevices();
        const id = device.deviceId ?? device.id;
        const previousRoomId = devices[id]?.room?.id;
        const dbroom = this.resolveCachedRoom(
            room ?? {
                id: device.roomId ?? device.room?.id,
                name: device.roomName ?? device.room?.name,
            }
        );

        const record = this.toDeviceRecord(device, dbroom);
        const savedRecord = await this.devicesDb.save(record);
        const savedDevice = this.toMemoryDevice(
            { ...device, ...savedRecord, id },
            devices[id],
            dbroom
        );
        devices[id] = savedDevice;
        roomDB.syncDeviceRelation(savedDevice, previousRoomId);
        logger.info(`[SMART HOME DB] Saved device: ${id}`);
        return savedDevice;
    }

    async updateDeviceInfo(device) {
        const id = device.deviceId || device.id;
        if (!this.devices[id]) {
            logger.error(`[SMART HOME DB] Device ${id} doesn't exist`);
            throw new Error('Device does not exist');
        }

        const previousRoomId = this.devices[id]?.room?.id;
        const update = {};
        const current = this.devices[id];
        const controlType = device.control_type ?? device.controlType;

        if (device.name !== undefined && device.name !== current.name) update.name = device.name;
        if (device.connected !== undefined && device.connected !== current.connected) {
            update.connected = device.connected;
        }
        if (controlType !== undefined && controlType !== current.control_type) {
            update.control_type = controlType;
        }

        if (Object.keys(update).length) {
            await this.devicesDb.update({ id }, update);
        }

        this.devices[id] = this.toMemoryDevice(device, this.devices[id]);
        roomDB.syncDeviceRelation(this.devices[id], previousRoomId);
        logger.info(`[SMART HOME DB] Updated device info: ${id}`);
        return this.devices[id];
    }

    async updateDeviceState(deviceId, state) {
        const devices = this.getAllDevices();
        if (!devices[deviceId]) {
            logger.error(`[SMART HOME DB] Device ${deviceId} doesn't exist`);
            throw new Error('Device does not exist');
        }
        const previousRoomId = devices[deviceId]?.room?.id;
        devices[deviceId] = {
            ...devices[deviceId],
            state,
        };
        roomDB.syncDeviceRelation(devices[deviceId], previousRoomId);
        logger.info(`[SMART HOME DB] Updated device state: ${deviceId}`);
        return devices[deviceId];
    }

    async deleteDevice(deviceId) {
        const devices = this.getAllDevices();
        const previousRoomId = devices[deviceId]?.room?.id;
        await this.devicesDb.delete({ id: deviceId });
        delete devices[deviceId];
        roomDB.removeDeviceRelation(deviceId, previousRoomId);
        logger.info(`[SMART HOME DB] Deleted device: ${deviceId}`);
    }

    async updateRoom(id, roomId) {
        const devices = this.getAllDevices();
        if (!devices[id]) {
            logger.error(`[SMART HOME DB] Device ${id} doesn't exist`);
            throw new Error('Device does not exist');
        }

        const dbroom = this.resolveCachedRoom({ id: roomId });
        const previousRoomId = devices[id].room?.id;

        await this.devicesDb.save(this.toDeviceRecord(devices[id], dbroom));

        const savedDevice = this.toMemoryDevice(devices[id], devices[id], dbroom);
        devices[id] = savedDevice;
        roomDB.syncDeviceRelation(savedDevice, previousRoomId);
        logger.info(`[SMART HOME DB] Updated device room: ${id} -> ${roomId}`);
        return savedDevice;
    }

    clearRoomForDevices(devices = []) {
        const cachedDevices = this.getAllDevices();

        for (const device of devices) {
            const id = device.deviceId ?? device.id;
            if (cachedDevices[id]) {
                cachedDevices[id] = {
                    ...cachedDevices[id],
                    room: null,
                };
            }
        }
    }
}

export const smartHomeDevicesDB = new SmartHomeDevicesDB();
export default SmartHomeDevicesDB;
