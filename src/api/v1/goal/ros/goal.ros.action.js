import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';

class GoalRosAction {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[GOAL ROS ACTION] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.currentGoal = null;
            this.currentGoalBytes = null;
            this.feedback = null;
            this.result = null;
            this.status = null;
            this.createAction();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.currentGoal = null;
            this.currentGoalBytes = null;
            this.feedback = null;
            this.result = null;
            this.status = null;
            this.createAction();
        }
    }

    createAction() {
        this._cleanup();

        this.sendGoalClient = new ROSLIB.Service({
            ros: this.ros,
            name: '/navigate_to_pose/_action/send_goal',
            serviceType: 'nav2_msgs/action/NavigateToPose_SendGoal',
        });

        this.getResultClient = new ROSLIB.Service({
            ros: this.ros,
            name: '/navigate_to_pose/_action/get_result',
            serviceType: 'nav2_msgs/action/NavigateToPose_GetResult',
        });

        this.feedbackListener = new ROSLIB.Topic({
            ros: this.ros,
            name: '/navigate_to_pose/_action/feedback',
            messageType: 'nav2_msgs/action/NavigateToPose_FeedbackMessage',
        });

        this.statusListener = new ROSLIB.Topic({
            ros: this.ros,
            name: '/navigate_to_pose/_action/status',
            messageType: 'action_msgs/msg/GoalStatusArray',
        });

        this.feedbackListener.subscribe(msg => {
            this.handleFeedback(msg);
        });

        this.statusListener.subscribe(msg => {
            this.handleStatus(msg);
        });
    }

    _cleanup() {
        if (this.feedbackListener) {
            try {
                this.feedbackListener.unsubscribe();
            } catch (e) {
                logger.error(`[GOAL ROS ACTION] Error unsubscribing feedbackListener: ${e.message}`);
            }
            this.feedbackListener = null;
        }
        if (this.statusListener) {
            try {
                this.statusListener.unsubscribe();
            } catch (e) {
                logger.error(`[GOAL ROS ACTION] Error unsubscribing statusListener: ${e.message}`);
            }
            this.statusListener = null;
        }
    }

    generateUuid() {
        const bytes = [];
        for (let i = 0; i < 16; i++) {
            bytes.push(Math.floor(Math.random() * 256));
        }
        const hex = bytes.map(b => b.toString(16).padStart(2, '0'));
        const uuidStr = [
            hex.slice(0, 4).join(''),
            hex.slice(4, 6).join(''),
            hex.slice(6, 8).join(''),
            hex.slice(8, 10).join(''),
            hex.slice(10, 16).join('')
        ].join('-');
        return {
            bytes: bytes,
            string: uuidStr
        };
    }

    isSameUuid(uuid1, uuid2) {
        if (!uuid1 || !uuid2) return false;
        if (uuid1.length !== uuid2.length) return false;
        for (let i = 0; i < uuid1.length; i++) {
            if (uuid1[i] !== uuid2[i]) return false;
        }
        return true;
    }

    executeGoal(poseMessage) {
        if (!this.sendGoalClient) throw new Error('goal action client is not connected');

        const uuid = this.generateUuid();
        this.currentGoal = {
            goalID: uuid.string,
            goalMessage: poseMessage,
            isFinished: false
        };
        this.currentGoalBytes = uuid.bytes;
        this.feedback = null;
        this.result = null;
        this.status = null;

        const request = new ROSLIB.ServiceRequest({
            goal_id: { uuid: uuid.bytes },
            goal: {
                pose: poseMessage.pose
            }
        });

        logger.info(`[GOAL ROS ACTION] Sending goal ${uuid.string} to ROS 2 action server...`);
        this.sendGoalClient.callService(request, response => {
            logger.info(`[GOAL ROS ACTION] Goal response: ${JSON.stringify(response)}`);
            if (!response.accepted) {
                logger.warn('[GOAL ROS ACTION] Goal rejected by action server');
                this.status = { status: 6, text: 'REJECTED' };
                if (this.currentGoal && this.currentGoal.goalID === uuid.string) {
                    this.currentGoal.isFinished = true;
                }
                return;
            }

            logger.info('[GOAL ROS ACTION] Goal accepted by action server');
            this.status = { status: 1, text: 'ACCEPTED' };

            this.requestResult(uuid);
        }, error => {
            logger.error(`[GOAL ROS ACTION] Error calling send_goal service: ${error}`);
            this.status = { status: 6, text: 'SERVICE_ERROR' };
            if (this.currentGoal && this.currentGoal.goalID === uuid.string) {
                this.currentGoal.isFinished = true;
            }
        });

        return uuid.string;
    }

    requestResult(uuid) {
        const request = new ROSLIB.ServiceRequest({
            goal_id: { uuid: uuid.bytes }
        });

        this.getResultClient.callService(request, response => {
            logger.info(`[GOAL ROS ACTION] Goal result: ${JSON.stringify(response)}`);
            if (this.currentGoal && this.currentGoal.goalID === uuid.string) {
                this.result = response.result;
                this.status = { status: response.status, text: this.getStatusText(response.status) };
                this.currentGoal.isFinished = true;
            }
        }, error => {
            logger.error(`[GOAL ROS ACTION] Error calling get_result service: ${error}`);
            if (this.currentGoal && this.currentGoal.goalID === uuid.string) {
                this.currentGoal.isFinished = true;
            }
        });
    }

    handleFeedback(msg) {
        if (!this.currentGoal || !this.currentGoalBytes) return;
        if (!this.isSameUuid(msg.goal_id?.uuid, this.currentGoalBytes)) return;
        this.feedback = msg.feedback;
    }

    handleStatus(msg) {
        if (!this.currentGoal || !this.currentGoalBytes) return;
        const statusList = msg.status_list || [];
        const match = statusList.find(s => this.isSameUuid(s.goal_info?.goal_id?.uuid, this.currentGoalBytes));
        if (match) {
            const statusCode = match.status;
            this.status = { status: statusCode, text: this.getStatusText(statusCode) };
            if (statusCode === 4 || statusCode === 5 || statusCode === 6) {
                this.currentGoal.isFinished = true;
            }
        }
    }

    getStatusText(statusCode) {
        switch (statusCode) {
            case 1: return 'ACCEPTED';
            case 2: return 'EXECUTING';
            case 3: return 'CANCELING';
            case 4: return 'SUCCEEDED';
            case 5: return 'CANCELED';
            case 6: return 'ABORTED';
            default: return 'UNKNOWN';
        }
    }

    getFeedback() {
        return this.feedback;
    }

    getGoal() {
        if (!this.currentGoal) throw new Error('no active goal');
        const pose = this.currentGoal.goalMessage?.pose || this.currentGoal.goalMessage?.goal?.pose;
        const position = pose?.pose?.position ?? {};
        const orientation = pose?.pose?.orientation ?? {};
        return {
            goal_id: this.currentGoal.goalID,
            frame_id: pose?.header?.frame_id,
            x: position.x,
            y: position.y,
            yaw: this.quaternionToYaw(orientation),
            status: this.status,
            feedback: this.feedback,
            result: this.result,
            is_finished: this.currentGoal.isFinished,
        };
    }

    clearGoal() {
        this.currentGoal = null;
        this.currentGoalBytes = null;
        this.feedback = null;
        this.result = null;
        this.status = null;
    }

    quaternionToYaw(quaternion = {}) {
        const { x = 0, y = 0, z = 0, w = 1 } = quaternion;
        return Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z));
    }
}

export default new GoalRosAction();
