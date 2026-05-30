import logger from '#utils/logger.js';
import { dbRepositories } from '#src/db/db.repositories.js';
import { AppDataSource } from '#src/db/datasources.js';
import roomRosTopic from './ros/room.ros.topic.js';

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
                this.cacheRoom(room);
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

    hasRoom(id) {
        return Boolean(this.getRoomById(id));
    }

    cacheDeviceForRoom(device) {
        if (!device) return device;
        const { room, ...deviceWithoutRoom } = device;
        return deviceWithoutRoom;
    }

    cacheRoom(room) {
        const cachedRoom = {
            ...room,
            devices: (room.devices ?? []).map(device => this.cacheDeviceForRoom(device)),
        };
        this.rooms[cachedRoom.id] = cachedRoom;
        return cachedRoom;
    }

    async refreshRoom(id) {
        const room = await this.roomsDb.findOne({
            where: { id },
            relations: { devices: true },
        });
        if (!room) {
            throw new Error(`room ${id} was not saved`);
        }
        return this.cacheRoom(room);
    }

    syncDeviceRelation(device, previousRoomId, options = {}) {
        if (!this.rooms) return;

        const updatedRoomIds = new Set();

        if (previousRoomId && this.rooms[previousRoomId]?.devices) {
            this.rooms[previousRoomId].devices = this.rooms[previousRoomId].devices.filter(
                currentDevice => currentDevice.id !== device.id
            );
            updatedRoomIds.add(previousRoomId);
        }

        const roomId = device.room?.id;
        if (!roomId || !this.rooms[roomId]) {
            this.publishSyncedRoomEvents(updatedRoomIds, options);
            return;
        }

        this.rooms[roomId].devices = this.rooms[roomId].devices || [];
        const cachedDevice = this.cacheDeviceForRoom(device);
        const existingIndex = this.rooms[roomId].devices.findIndex(
            currentDevice => currentDevice.id === device.id
        );

        if (existingIndex >= 0) {
            this.rooms[roomId].devices[existingIndex] = cachedDevice;
        } else {
            this.rooms[roomId].devices.push(cachedDevice);
        }
        updatedRoomIds.add(roomId);
        this.publishSyncedRoomEvents(updatedRoomIds, options);
    }

    publishSyncedRoomEvents(roomIds, options = {}) {
        if (options.publishRoomEvent === false) return;

        for (const roomId of roomIds) {
            const room = this.rooms[roomId];
            if (room) {
                roomRosTopic.publishRoomEvent('UPDATE', room);
            }
        }
    }

    async registerRoom(room) {
        this.getAllRooms();
        const roomToSave = { ...room };
        delete roomToSave.created_at;
        delete roomToSave.updated_at;

        const savedRoom = await this.roomsDb.save(roomToSave);
        const saved = await this.refreshRoom(savedRoom.id);
        if (saved.devices?.length || roomToSave.devices?.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            await smartHomeDevicesDB.cacheSavedDevices(saved.devices ?? roomToSave.devices, {
                publishRoomEvent: false,
            });
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

        const roomToSave = { ...rooms[id], ...updateData, id };
        if (!updateData.devices) {
            delete roomToSave.devices;
        }

        await this.roomsDb.save(roomToSave);
        rooms[id] = await this.refreshRoom(id);
        if (rooms[id]?.devices?.length || updateData.devices?.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            await smartHomeDevicesDB.cacheSavedDevices(rooms[id]?.devices ?? updateData.devices, {
                publishRoomEvent: false,
            });
        }
        logger.info(`[ROOM DB] Updated room info: ${id}`);
        return rooms[id];
    }

    async deleteRoom(id) {
        const rooms = this.getAllRooms();
        const devices = rooms[id]?.devices ?? [];
        if (devices.length) {
            await dbRepositories.device.save(devices.map(device => ({ ...device, room: null })));
        }
        await this.roomsDb.delete({ id });
        delete rooms[id];
        if (devices.length) {
            const { smartHomeDevicesDB } = await import('../smart-home/smart-home.db.js');
            await smartHomeDevicesDB.cacheSavedDevices(devices, { publishRoomEvent: false });
        }
        logger.info(`[ROOM DB] Deleted room: ${id}`);
    }
}

export const roomDB = new RoomDB();
export default RoomDB;
