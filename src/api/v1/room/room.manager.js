import roomRosTopic from './ros/room.ros.topic.js';

class RoomManager {
    constructor() {
        this.rooms;
    }

    setRooms(rooms) {
        this.rooms = rooms;
        return this.rooms;
    }

    stripDeviceRoom(device) {
        if (!device) return device;
        const { room, ...deviceWithoutRoom } = device;
        return deviceWithoutRoom;
    }

    cacheRoom(room) {
        const cachedRoom = {
            ...room,
            devices: (room.devices ?? []).map(device => this.stripDeviceRoom(device)),
        };
        this.rooms[cachedRoom.id] = cachedRoom;
        return cachedRoom;
    }

    syncDevice(device, previousRoomId, options = {}) {
        if (!this.rooms || !device?.id) return [];

        const nextRoomId = device.room?.id ?? device.roomId;
        const touchedRoomIds = new Set();

        if (previousRoomId && this.rooms[previousRoomId]?.devices) {
            const devices = this.rooms[previousRoomId].devices;
            const index = devices.findIndex(currentDevice => currentDevice.id === device.id);
            if (index >= 0) {
                devices.splice(index, 1);
                touchedRoomIds.add(previousRoomId);
            }
        }

        if (nextRoomId && this.rooms[nextRoomId]?.devices) {
            const deviceForRoom = this.stripDeviceRoom(device);
            const devices = this.rooms[nextRoomId].devices;
            const index = devices.findIndex(currentDevice => currentDevice.id === device.id);
            if (index >= 0) {
                devices[index] = { ...devices[index], ...deviceForRoom };
            } else {
                devices.push(deviceForRoom);
            }
            touchedRoomIds.add(nextRoomId);
        }

        this.publishRoomUpdates([...touchedRoomIds], options);
        return [...touchedRoomIds];
    }

    removeDevice(deviceId, previousRoomId, options = {}) {
        if (!this.rooms || !deviceId || !previousRoomId || !this.rooms[previousRoomId]?.devices) {
            return [];
        }

        const devices = this.rooms[previousRoomId].devices;
        const index = devices.findIndex(device => device.id === deviceId);
        if (index < 0) return [];

        devices.splice(index, 1);
        this.publishRoomUpdates([previousRoomId], options);
        return [previousRoomId];
    }

    publishRoomUpdates(roomIds, options = {}) {
        if (options.publishRoomEvent === false) return;

        for (const roomId of roomIds) {
            const room = this.rooms?.[roomId];
            if (room) {
                roomRosTopic.publishRoomEvent('UPDATE', room);
            }
        }
    }
}

export const roomManager = new RoomManager();
export default RoomManager;
