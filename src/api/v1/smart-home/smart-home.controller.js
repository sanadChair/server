import { smartHomeService } from './smart-home.service.js';

// ==================== Discovery ====================

export async function discover(req, res, next) {
    const timeoutMs = Number(req.query?.timeoutMs ?? 4000);
    const devices = await smartHomeService.discoverDevices(
        timeoutMs < 10000 && timeoutMs > 0 ? timeoutMs : 400
    );
    return devices;
}

// ==================== Device Controllers ====================

export async function getAllDevices(req, res, next) {
    const devices = await smartHomeService.getAllDevices();
    return devices;
}

export async function getInfo(req, res, next) {
    const { id } = req.params;
    const response = await smartHomeService.getDevInfo(id);
    return response;
}

export async function getDevice(req, res, next) {
    const { id } = req.params;
    const device = await smartHomeService.getDevice(id);
    return device;
}

export async function control(req, res, next) {
    const { id, state } = req.body;
    const device = await smartHomeService.controlDev(id, state);
    return device;
}

export async function registerDevice(req, res, next) {
    const { device, room } = req.body;
    const savedDevice = await smartHomeService.addDevice(device, room);
    return savedDevice;
}

export async function updateDeviceInfo(req, res, next) {
    const { id, room, name } = req.body;
    const device = await smartHomeService.updateDevice({
        id,
        room,
        name,
    });
    return device;
}

export async function deleteDevice(req, res, next) {
    const { id } = req.params;
    await smartHomeService.deleteDevice(id);
    return {
        id,
        deleted: true,
    };
}

export async function changeDeviceRoom(req, res, next) {
    const { id } = req.params;
    const { roomId } = req.body;
    const device = await smartHomeService.changeDeviceRoom({ id, roomId });
    return device;
}

// ==================== Room Controllers ====================

export async function getAllRooms(req, res, next) {
    const rooms = await smartHomeService.getAllRooms();
    return rooms;
}

export async function registerRoom(req, res, next) {
    const room = req.body;
    const savedRoom = await smartHomeService.registerRoom(room);
    return savedRoom;
}

export async function updateRoom(req, res, next) {
    const data = req.body;
    const updatedRoom = await smartHomeService.updateRoom(data);
    return updatedRoom;
}

export async function getRoom(req, res, next) {
    const { id } = req.params;
    const room = await smartHomeService.getRoom(id);
    return room;
}

export async function deleteRoom(req, res, next) {
    const { id } = req.params;
    await smartHomeService.deleteRoom(id);
    return {
        id,
        deleted: true,
    };
}

export async function navigateToRoom(req, res, next) {
    const { id } = req.params;
    const result = await smartHomeService.navigateToRoom(id);
    return result;
}
