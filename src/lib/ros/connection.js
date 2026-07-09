import 'dotenv/config';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import EventEmitter from 'events';

const ROSBRIDGE_HOST = process.env.ROSBRIDGE_HOST || 'localhost';
const ROSBRIDGE_PORT = process.env.ROSBRIDGE_PORT || '9090';

const ROS_URL = `ws://${ROSBRIDGE_HOST}:${ROSBRIDGE_PORT}`;

class RosConnection extends EventEmitter {
    constructor() {
        if (RosConnection.instance) {
            return RosConnection.instance;
        }
        super();
        this.setMaxListeners(50);
        this.url = ROS_URL;
        this.ros = null;
        this.connected = false;

        this._connect();

        RosConnection.instance = this;
    }

    _connect() {
        this.ros = new ROSLIB.Ros({ url: this.url, encoding: 'bson' });

        this.ros.on('connection', () => {
            this.connected = true;
            logger.info(`[ROS-CONNECTION] Connected to rosbridge at ${this.url}`);
            this.emit('ros_reconnected', this.ros);
        });

        this.ros.on('error', err => {
            this.connected = false;
            logger.error(`[ROS-CONNECTION] ROS error: ${err.message}`);
            this.emit('ros_reconnection_error', this.ros);
        });

        this.ros.on('close', () => {
            if (this.connected) {
                logger.warn('[ROS-CONNECTION] Connection to rosbridge closed');
            } else {
                logger.warn('[ROS-CONNECTION] Failed to connect to rosbridge');
            }
            this.connected = false;
            logger.info('[ROS-CONNECTION] Retrying in 2s');
            setTimeout(() => this._connect(), 2000);
        });
    }

    isConnected() {
        return this.connected && this.ros.isConnected;
    }

    getRos() {
        if (!this.ros) {
            throw new Error('ROS connection not initialized');
        }
        return this.ros;
    }
}

const rosHandler = new RosConnection();
export default rosHandler;
