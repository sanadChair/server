import logger from '#utils/logger.js';
import { dbRepositories } from '#src/db/db.repositories.js';

class SmartHomeDB {
    get roomsDb() {
        return dbRepositories.room;
    }

    get devicesDb() {
        return dbRepositories.device;
    }

    // Helpers
    _stripDeviceRoom(device) {
        if (!device) return device;
        const { room, ...deviceWithoutRoom } = device;
        return deviceWithoutRoom;
    }

    _toMemoryDevice(dev) {
        if (!dev) return null;
        return {
            ...this._stripDeviceRoom(dev),
            state: dev.state ?? 0,
            room: dev.room
                ? {
                      id: dev.room.id,
                      name: dev.room.name,
                      min_x: dev.room.min_x,
                      max_x: dev.room.max_x,
                      min_y: dev.room.min_y,
                      max_y: dev.room.max_y,
                      theta: dev.room.theta,
                      pose_x: dev.room.pose_x,
                      pose_y: dev.room.pose_y,
                      pose_theta: dev.room.pose_theta,
                  }
                : null,
        };
    }

    _toMemoryRoom(room) {
        if (!room) return null;
        return {
            id: room.id,
            name: room.name,
            min_x: room.min_x,
            max_x: room.max_x,
            min_y: room.min_y,
            max_y: room.max_y,
            theta: room.theta,
            pose_x: room.pose_x,
            pose_y: room.pose_y,
            pose_theta: room.pose_theta,
            created_at: room.created_at,
            updated_at: room.updated_at,
            devices: (room.devices ?? []).map(d => this._stripDeviceRoom(d)),
        };
    }

    _deviceToRecord(device, room) {
        const record = {
            id: device.deviceId ?? device.id,
            name: device.name,
            control_type: device.control_type ?? device.controlType,
            connected: device.connected ?? false,
            state: device.state ?? 0,
        };
        if (room !== undefined) {
            record.room = room ? { id: room.id } : null;
        }
        return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
    }

    // ==================== Devices ====================

    async getAllDevices() {
        const devices = await this.devicesDb.find({ relations: { room: true } });
        const result = {};
        for (const dev of devices) {
            result[dev.id] = this._toMemoryDevice(dev);
        }
        return result;
    }

    async getDevice(id) {
        const dev = await this.devicesDb.findOne({ where: { id }, relations: { room: true } });
        return dev ? this._toMemoryDevice(dev) : null;
    }

    async saveDevice(device, room) {
        const id = device.deviceId ?? device.id;
        const record = this._deviceToRecord(device, room);
        const saved = await this.devicesDb.save(record);
        logger.info(`[SMART HOME DB] Saved device: ${id}`);
        return this._toMemoryDevice({ ...saved, room: room ?? null });
    }

    async updateDeviceInfo(device) {
        const id = device.deviceId || device.id;
        const existing = await this.devicesDb.findOne({ where: { id }, relations: { room: true } });
        if (!existing) {
            logger.error(`[SMART HOME DB] Device ${id} doesn't exist`);
            throw new Error('Device does not exist');
        }

        const update = {};
        if (device.name !== undefined && device.name !== existing.name) update.name = device.name;
        if (device.connected !== undefined && device.connected !== existing.connected) {
            update.connected = device.connected;
        }
        const controlType = device.control_type ?? device.controlType;
        if (controlType !== undefined && controlType !== existing.control_type) {
            update.control_type = controlType;
        }

        if (Object.keys(update).length) {
            await this.devicesDb.update({ id }, update);
        }

        const refreshed = await this.devicesDb.findOne({ where: { id }, relations: { room: true } });
        logger.info(`[SMART HOME DB] Updated device info: ${id}`);
        return this._toMemoryDevice(refreshed);
    }

    async updateDeviceState(deviceId, state) {
        const existing = await this.devicesDb.findOne({ where: { id: deviceId }, relations: { room: true } });
        if (!existing) {
            logger.error(`[SMART HOME DB] Device ${deviceId} doesn't exist`);
            throw new Error('Device does not exist');
        }
        await this.devicesDb.update({ id: deviceId }, { state });
        const refreshed = await this.devicesDb.findOne({ where: { id: deviceId }, relations: { room: true } });
        logger.info(`[SMART HOME DB] Updated device state: ${deviceId}`);
        return this._toMemoryDevice(refreshed);
    }

    async updateDeviceRoom(id, roomId) {
        const existing = await this.devicesDb.findOne({ where: { id }, relations: { room: true } });
        if (!existing) {
            logger.error(`[SMART HOME DB] Device ${id} doesn't exist`);
            throw new Error('Device does not exist');
        }

        const room = roomId ? await this.roomsDb.findOne({ where: { id: roomId } }) : null;
        if (roomId && !room) {
            throw new Error(`room ${roomId} doesn't exist`);
        }

        await this.devicesDb.save({ id, room: room ? { id: room.id } : null });
        const refreshed = await this.devicesDb.findOne({ where: { id }, relations: { room: true } });
        logger.info(`[SMART HOME DB] Updated device room: ${id} -> ${roomId}`);
        return this._toMemoryDevice(refreshed);
    }

    async deleteDevice(deviceId) {
        await this.devicesDb.delete({ id: deviceId });
        logger.info(`[SMART HOME DB] Deleted device: ${deviceId}`);
    }

    // ==================== Rooms ====================

    async getAllRooms() {
        const rooms = await this.roomsDb.find({ relations: { devices: true } });
        const result = {};
        for (const room of rooms) {
            result[room.id] = this._toMemoryRoom(room);
        }
        return result;
    }

    async getRoom(id) {
        const room = await this.roomsDb.findOne({ where: { id }, relations: { devices: true } });
        return room ? this._toMemoryRoom(room) : null;
    }

    async hasRoom(id) {
        const count = await this.roomsDb.count({ where: { id } });
        return count > 0;
    }

    async roomExistsByName(name) {
        const count = await this.roomsDb.count({ where: { name } });
        return count > 0;
    }

    async saveRoom(room) {
        const roomToSave = { ...room };
        const saved = await this.roomsDb.save(roomToSave);
        logger.info(`[SMART HOME DB] Saved room: ${saved.id}`);
        return this._toMemoryRoom(saved);
    }

    async updateRoom(roomData) {
        const id = roomData.id;
        const existing = await this.roomsDb.findOne({ where: { id }, relations: { devices: true } });
        if (!existing) {
            throw new Error(`trying to update a room that doesn't exist ${id}`);
        }

        const updateData = { ...roomData };
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.updated_at;
        if (!updateData.devices) {
            delete updateData.devices;
        }

        const roomToSave = { ...existing, ...updateData, id };
        if (!updateData.devices) {
            delete roomToSave.devices;
        }

        const saved = await this.roomsDb.save(roomToSave);
        logger.info(`[SMART HOME DB] Updated room info: ${id}`);
        return this._toMemoryRoom(saved);
    }

    async deleteRoom(id) {
        const room = await this.roomsDb.findOne({ where: { id }, relations: { devices: true } });
        if (!room) {
            throw new Error(`trying to delete room that doesn't exist room id: ${id}`);
        }

        // Unassign all devices from this room
        if (room.devices && room.devices.length) {
            await this.devicesDb.save(
                room.devices.map(device => ({
                    id: device.id,
                    room: null,
                }))
            );
        }

        await this.roomsDb.delete({ id });
        logger.info(`[SMART HOME DB] Deleted room: ${id}`);
        return room.devices ?? [];
    }
}

export const smartHomeDB = new SmartHomeDB();
export default SmartHomeDB;
