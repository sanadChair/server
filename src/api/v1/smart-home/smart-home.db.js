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
                this.devices[dev.id] = dev;
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
        throw new Error(`devices DB wasnt initialized yet try restarting the server`)
    }

    getDevice(id) {
        const devices = this.getAllDevices();
        return devices[id];
    }

    async resolveRoom(room) {
        if (!room) return null;

        const id = room.id ?? room.roomId;
        const name = room.name ?? room.roomName;

        if (!id && !name) return null;

        const dbroom = id
            ? await dbRepositories.room.findOne({ where: { id } })
            : await dbRepositories.room.findOne({ where: { name } });

        if (!dbroom) {
            throw new Error(`room ${id || name} doesn't exist`);
        }

        if (name && dbroom.name !== name) {
            throw new Error(`room ${name} doesn't match room id ${id}`);
        }

        return dbroom;
    }

    async refreshDevice(id) {
        const savedDevice = await this.devicesDb.findOne({
            where: { id },
            relations: { room: true },
        });
        if (!savedDevice) {
            throw new Error(`device ${id} was not saved`);
        }
        this.devices[id] = savedDevice;
        return savedDevice;
    }

    async cacheSavedDevices(devices = []) {
        this.getAllDevices();
        const cachedDevices = [];

        for (const device of devices || []) {
            const id = device.deviceId ?? device.id;
            if (!id) continue;

            const previousRoomId = this.devices[id]?.room?.id;
            const savedDevice = await this.refreshDevice(id);
            roomDB.syncDeviceRelation(savedDevice, previousRoomId);
            cachedDevices.push(savedDevice);
        }

        if (cachedDevices.length) {
            logger.info(`[SMART HOME DB] Cached ${cachedDevices.length} saved device(s)`);
        }

        return cachedDevices;
    }

    async saveDevice(device, room) {
        const devices = this.getAllDevices();
        const id = device.deviceId ?? device.id;
        const dbroom = await this.resolveRoom(
            room ?? {
                id: device.roomId ?? device.room?.id,
                name: device.roomName ?? device.room?.name,
            }
        );
        const fullDevice = {
            ...device,
            id,
            control_type: device.control_type,
            connected: device.connected ?? false,
            room: dbroom ? { id: dbroom.id } : undefined,
        };

        delete fullDevice.deviceId;
        delete fullDevice.roomId;
        delete fullDevice.roomName;
        delete fullDevice.created_at;
        delete fullDevice.updated_at;

        await this.devicesDb.save(fullDevice);
        const savedDevice = await this.refreshDevice(id);
        roomDB.syncDeviceRelation(savedDevice);
        logger.info(`[SMART HOME DB] Saved device: ${id}`);
        return savedDevice;
    }

    async updateDeviceInfo(device) {
        const devices = this.getAllDevices();
        const id = device.deviceId || device.id;
        const updateData = {};
        if (device.connected !== undefined) updateData.connected = Boolean(device.connected);
        if (device.name !== undefined) updateData.name = device.name;
        if (device.control_type !== undefined) {
            updateData.control_type = device.control_type;
        }
        await this.devicesDb.update({ id }, updateData);
        devices[id] = await this.refreshDevice(id);
        logger.info(`[SMART HOME DB] Updated device info: ${id}`);
        return devices[id];
    }

    async updateDeviceState(deviceId, state) {
        const devices = this.getAllDevices();
        if (!devices[deviceId]) {
            logger.error(`[SMART HOME DB] Device ${deviceId} doesn't exist`);
            throw new Error('Device does not exist');
        }
        const updateData = { state };
        await this.devicesDb.update({ id: deviceId }, updateData);
        devices[deviceId] = await this.refreshDevice(deviceId);
        logger.info(`[SMART HOME DB] Updated device state: ${deviceId}`);
        return devices[deviceId];
    }

    async deleteDevice(deviceId) {
        const devices = this.getAllDevices();
        const previousRoomId = devices[deviceId]?.room?.id;
        await this.devicesDb.delete({ id: deviceId });
        delete devices[deviceId];
        roomDB.syncDeviceRelation({ id: deviceId }, previousRoomId);
        logger.info(`[SMART HOME DB] Deleted device: ${deviceId}`);
    }

    async updateRoom(id, roomId) {
        const devices = this.getAllDevices();
        if (!devices[id]) {
            logger.error(`[SMART HOME DB] Device ${id} doesn't exist`);
            throw new Error('Device does not exist');
        }

        const dbroom = await this.resolveRoom({ id: roomId });
        const previousRoomId = devices[id].room?.id;

        await this.devicesDb.save({
            ...devices[id],
            room: { id: dbroom.id },
        });

        const savedDevice = await this.refreshDevice(id);
        roomDB.syncDeviceRelation(savedDevice, previousRoomId);
        logger.info(`[SMART HOME DB] Updated device room: ${id} -> ${roomId}`);
        return savedDevice;
    }
}

export const smartHomeDevicesDB = new SmartHomeDevicesDB();
export default SmartHomeDevicesDB;
