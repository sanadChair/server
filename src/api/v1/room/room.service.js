import { roomDB } from './room.db.js';
import logger from '#utils/logger.js';
import roomRosTopic from './ros/room.ros.topic.js';
import goalRosAction from '../goal/ros/goal.ros.action.js';

class RoomService {
    async init() {
        await roomDB.initializeDB();
    }

    getAllRooms() {
        return roomDB.getAllRooms();
    }

    getRoom(id) {
        const room = roomDB.getRoomById(id);
        return room;
    }

    async registerRoom(room) {
        const rooms = this.getAllRooms();
        if (room.id && rooms[room.id]) {
            logger.warn(`[ROOM] room ${room.id} already exists`);
            throw new Error(`trying to register a room that already exists room id: ${room.id}`);
        }

        if (Object.values(rooms).find(currentRoom => currentRoom.name === room.name)) {
            logger.warn(`[ROOM] room ${room.name} already exists`);
            throw new Error(`trying to register a room that already exists room name: ${room.name}`);
        }

        const savedRoom = await roomDB.registerRoom(room);
        roomRosTopic.publishRoomEvent('NEW_ROOM', savedRoom);
        return savedRoom;
    }

    async updateRoom(data) {
        if (!roomDB.hasRoom(data.id)) {
            logger.warn(`[ROOM] room doesn't exist or undefined`);
            throw new Error(`trying to update a room that doesn't exist ${data.id}`);
        }

        const updatedRoom = await roomDB.updateRoom(data);

        roomRosTopic.publishRoomEvent('UPDATE', updatedRoom);
        return updatedRoom;
    }

    async deleteRoom(id) {
        if (!id || !roomDB.hasRoom(id)) {
            logger.warn(`[ROOM] room ${id} doesn't exist`);
            throw new Error(`trying to delete room that doesn't exist room id: ${id}`);
        }

        await roomDB.deleteRoom(id);

        roomRosTopic.publishRoomEvent('DELETED', { id });
        return;
    }

    async navigateToRoom(id) {
        const room = roomDB.getRoomById(id);
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

export const roomService = new RoomService();
export default RoomService;
