import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import { roomService } from '../room.service.js';

const mapToRosRoom = (room = {}) => ({
    id: room.id,
    name: room.name || '',
    min_x: Number(room.min_x) || 0.0,
    max_x: Number(room.max_x) || 0.0,
    min_y: Number(room.min_y) || 0.0,
    max_y: Number(room.max_y) || 0.0,
    theta: Number(room.theta) || 0.0,
    pose_x: Number(room.pose_x) || 0.0,
    pose_y: Number(room.pose_y) || 0.0,
    pose_theta: Number(room.pose_theta) || 0.0,
    devices: room.devices || [],
});

class RoomRosService {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[Room ROS Service] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.createService();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.createService();
        }
    }

    createService() {
        this.getAllRooms = new ROSLIB.Service({
            ros: this.ros,
            name: '/room/getAllRooms',
            serviceType: 'sanad_interfaces/srv/GetAllRooms',
        });
        this.getAllRooms.advertise(this.getAllRoomsCallback.bind(this));

        this.deleteRoom = new ROSLIB.Service({
            ros: this.ros,
            name: '/room/deleteRoom',
            serviceType: 'sanad_interfaces/srv/DeleteRoom',
        });
        this.deleteRoom.advertise(this.deleteRoomCallback.bind(this));

        this.getRoom = new ROSLIB.Service({
            ros: this.ros,
            name: '/room/getRoom',
            serviceType: 'sanad_interfaces/srv/GetRoom',
        });
        this.getRoom.advertise(this.getRoomCallback.bind(this));

        this.registerRoom = new ROSLIB.Service({
            ros: this.ros,
            name: '/room/registerRoom',
            serviceType: 'sanad_interfaces/srv/RegisterRoom',
        });
        this.registerRoom.advertise(this.registerRoomCallback.bind(this));

        this.updateRoom = new ROSLIB.Service({
            ros: this.ros,
            name: '/room/updateRoom',
            serviceType: 'sanad_interfaces/srv/UpdateRoom',
        });
        this.updateRoom.advertise(this.updateRoomCallback.bind(this));
    }

    getAllRoomsCallback(req, res) {
        const rooms = roomService.getAllRooms();
        res.rooms = Object.values(rooms || {}).map(mapToRosRoom);
        return true;
    }

    deleteRoomCallback(req, res) {
        const rooms = roomService.getAllRooms();
        if (!rooms[req.id]) {
            logger.warn(
                `[Room ROS service] Failed to delete room (name=${req.id}): room doesn't exist`
            );
            res.success = false;
            return true;
        }
        roomService.deleteRoom(req.id).catch(error => {
            logger.warn(`[Room ROS service] Failed to delete room: ${error.message}`);
        });
        res.success = true;
        return true;
    }

    getRoomCallback(req, res) {
        const rooms = roomService.getAllRooms();
        // Fallback: look up by name (req.name from GetRoom.srv) or id
        const room =
            Object.values(rooms || {}).find(r => r.name === req.name || r.id === req.name) ||
            rooms?.[req.id];
        res.room = room ? mapToRosRoom(room) : mapToRosRoom({});
        res.success = !!room;
        return true;
    }

    registerRoomCallback(req, res) {
        const room = req.room;
        const rooms = roomService.getAllRooms();
        if (rooms[room.id] || Object.values(rooms || {}).find(r => r.name === room.name)) {
            logger.warn(
                `[Room ROS service] Failed to create room (name=${room.name}): room already exists`
            );
            res.success = false;
            return true;
        }
        roomService.registerRoom(room).catch(error => {
            logger.warn(`[Room ROS service] Failed to register room: ${error.message}`);
        });
        res.success = true;
        return true;
    }

    updateRoomCallback(req, res) {
        const room = req.room;

        const rooms = roomService.getAllRooms();
        const existing = Object.values(rooms || {}).find(r => r.name === room.name);
        if (!existing || rooms[room.id]) {
            logger.warn(
                `[Room ROS service] Failed to update room (name=${room.name}): room not found`
            );
            res.success = false;
            return true;
        }
        room.id = existing.id;
        roomService.updateRoom(room).catch(error => {
            logger.warn(`[Room ROS service] Failed to update room: ${error.message}`);
        });
        res.success = true;
        return true;
    }
}

export default new RoomRosService();
