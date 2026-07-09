import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import irInputManager from '../ir.input.manager.js';

class IRRosTopic {
    constructor() {
        if (IRRosTopic.instance) return IRRosTopic.instance;

        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[IR ROS TOPIC] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.topic = this.createTopic();
            this.subscribe();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.topic = this.createTopic();
            this.subscribe();
        }

        IRRosTopic.instance = this;
    }

    createTopic() {
        const topic = new ROSLIB.Topic({
            ros: this.ros,
            name: '/ir/hexCode',
            messageType: 'std_msgs/String',
        });
        logger.info('[IR ROS TOPIC] Topic created: /ir/hexCode');
        return topic;
    }

    subscribe() {
        if (!this.topic) return;

        this.topic.subscribe(message => {
            const hexCode = this.getHexCode(message);
            irInputManager.resolveKey(hexCode);
        });
    }

    getHexCode(message = {}) {
        return message.hexCode;
    }
}

const irRosTopic = new IRRosTopic();
export default irRosTopic;
