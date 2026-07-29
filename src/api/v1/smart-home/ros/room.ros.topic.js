import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';

class RoomRosTopic {
    constructor() {
        if (RoomRosTopic.instance) return RoomRosTopic.instance;
        logger.info('[Room ROS TOPIC] Initializing Room topic handler');
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[Room ROS TOPIC] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.topic = this.createTopic();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.topic = this.createTopic();
        }
        RoomRosTopic.instance = this;
    }

    createTopic() {
        const roomTopic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/Room/RoomEvents',
            messageType: '/sanad_interfaces/msg/RoomEvent',
        });
        logger.info('[Room ROS TOPIC] Topic created: /Room/RoomEvents');
        return roomTopic;
    }

    publishRoomEvent(eventName, room) {
        if (!this.topic) return;
        const message = new ROSLIB.Message({
            event: eventName,
            room: JSON.stringify(room),
        });
        switch (eventName) {
            case 'NEW_ROOM':
            case 'DELETED':
            case 'UPDATE':
                this.topic.publish(message);
                break;
            default:
                logger.warn(`[ROOM] event name is not supported: ${eventName}`);
        }
    }
}

const roomRosTopic = new RoomRosTopic();
export default roomRosTopic;
