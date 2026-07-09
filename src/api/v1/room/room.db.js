import logger from '#utils/logger.js';
import { dbRepositories } from '#src/db/db.repositories.js';
import { AppDataSource } from '#src/db/datasources.js';
import { roomManager } from './room.manager.js';

class RoomDB {
    constructor() {
        this.rooms;
    }

    get roomsDb() {
        return dbRepositories.room;
    }

    async initializeDB() {
        try {
            const roomsArr = await this.roomsDb.find({ relations: { devices: true } });
            this.rooms = roomManager.setRooms({});
            for (const room of roomsArr) {
                this.cacheRoom(room);
            }
            return this.rooms;
        } catch (err) {
            if (!AppDataSource.isInitialized) {
                throw err;
            }
            logger.warn(`[ROOM DB] Failed to read DB, initializing empty: ${err.message}`);
            this.rooms = roomManager.setRooms({});
            return this.rooms;
        }
    }

    getAllRooms() {
        if (this.rooms) {
            return this.rooms;
        }
        throw new Error(`room DB wasnt initilaized yet, try restarting server`);
    }

    getRoomById(id) {
        if (this.rooms) {
            return this.rooms[id];
        }
        throw new Error(`room DB wasnt initilaized yet, try restarting server`);
    }

    hasRoom(id) {
        return Boolean(this.getRoomById(id));
    }

    cacheRoom(room) {
        return roomManager.cacheRoom(room);
    }

    syncDeviceRelation(device, previousRoomId, options = {}) {
        return roomManager.syncDevice(device, previousRoomId, options);
    }

    removeDeviceRelation(deviceId, previousRoomId, options = {}) {
        return roomManager.removeDevice(deviceId, previousRoomId, options);
    }

    async registerRoom(room) {
        this.getAllRooms();
        const roomToSave = { ...room };
        console.log(roomToSave)
        const savedRoom = await this.roomsDb.save(roomToSave);
        const saved = this.cacheRoom(savedRoom);
        logger.info(`[ROOM DB] Saved room: ${saved.id}`);
        return saved;
    }

    async updateRoom(roomData) {
        const rooms = this.getAllRooms();
        const id = roomData.id;
        const updateData = { ...roomData };
        delete updateData.id;
        delete updateData.created_at;
        delete updateData.updated_at;

        const existingDevices = rooms[id]?.devices ?? [];
        const roomToSave = { ...rooms[id], ...updateData, id };
        if (!updateData.devices) {
            delete roomToSave.devices;
        }

        const savedRoom = await this.roomsDb.save(roomToSave);
        rooms[id] = this.cacheRoom({
            ...savedRoom,
            devices: updateData.devices ?? existingDevices,
        });
        logger.info(`[ROOM DB] Updated room info: ${id}`);
        return rooms[id];
    }

    async deleteRoom(id) {
        const rooms = this.getAllRooms();
        const devices = rooms[id]?.devices ?? [];
        if (devices.length) {
            await dbRepositories.device.save(
                devices.map(device => ({
                    id: device.id,
                    name: device.name,
                    control_type: device.control_type,
                    connected: device.connected ?? false,
                    room: null,
                }))
            );
        }
        await this.roomsDb.delete({ id });
        delete rooms[id];
        if (devices.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            smartHomeDevicesDB.clearRoomForDevices(devices);
        }
        logger.info(`[ROOM DB] Deleted room: ${id}`);
        return devices;
    }
}

export const roomDB = new RoomDB();
export default RoomDB;
