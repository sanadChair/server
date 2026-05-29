import logger from '#utils/logger.js';
import { dbRepositories } from '#src/db/db.repositories.js';
import { AppDataSource } from '#src/db/datasources.js';

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
            this.rooms = {};
            for (const room of roomsArr) {
                this.rooms[room.id] = room;
            }
            return this.rooms;
        } catch (err) {
            if (!AppDataSource.isInitialized) {
                throw err;
            }
            logger.warn(`[ROOM DB] Failed to read DB, initializing empty: ${err.message}`);
            this.rooms = {};
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

    syncDeviceRelation(device, previousRoomId) {
        if (!this.rooms) return;

        if (previousRoomId && this.rooms[previousRoomId]?.devices) {
            this.rooms[previousRoomId].devices = this.rooms[previousRoomId].devices.filter(
                currentDevice => currentDevice.id !== device.id
            );
        }

        const roomId = device.room?.id;
        if (!roomId || !this.rooms[roomId]) return;

        this.rooms[roomId].devices = this.rooms[roomId].devices || [];
        const existingIndex = this.rooms[roomId].devices.findIndex(
            currentDevice => currentDevice.id === device.id
        );

        if (existingIndex >= 0) {
            this.rooms[roomId].devices[existingIndex] = device;
        } else {
            this.rooms[roomId].devices.push(device);
        }
    }

    async registerRoom(room) {
        const rooms = this.getAllRooms();
        for (const [_, ro] of Object.entries(rooms)) {
            if (ro.name === room.name) {
                logger.warn(`[room db] trying to register a room that already exist`);
                throw new Error(` trying to register a room that already exist: ${room.name}`);
            }
        }
        const roomToSave = { ...room };
        delete roomToSave.created_at;
        delete roomToSave.updated_at;

        const saved = await this.roomsDb.save(roomToSave);
        rooms[saved.id] = saved;
        if (saved.devices?.length || room.devices?.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            await smartHomeDevicesDB.cacheSavedDevices(saved.devices ?? room.devices);
        }
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

        await this.roomsDb.save({ ...rooms[id], ...updateData, id });
        rooms[id] = await this.roomsDb.findOne({
            where: { id },
            relations: { devices: true },
        });
        if (rooms[id]?.devices?.length || updateData.devices?.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            await smartHomeDevicesDB.cacheSavedDevices(rooms[id]?.devices ?? updateData.devices);
        }
        logger.info(`[ROOM DB] Updated room info: ${id}`);
        return rooms[id];
    }

    async deleteRoom(id) {
        const rooms = this.getAllRooms();
        await this.roomsDb.delete({ id });
        delete rooms[id];
        logger.info(`[ROOM DB] Deleted room: ${id}`);
    }
}

export const roomDB = new RoomDB();
export default RoomDB;
