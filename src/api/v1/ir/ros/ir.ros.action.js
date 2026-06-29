import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';

class IRRosAction {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[GOAL ROS ACTION] ROS reconnected, refreshing subscription...');
            this.ros = newRosInstance;
            this.createAction();
        });
        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.createAction();
        }
    }

    createAction() {
        this.irAction = ROSLIB.ActionClient({
            ros: this.ros,
            serverName: '/ir/readIrSignal',
            actionName: 'sanad_interfaces/ir/action/NavigateToPose',
        });
    }

    executeGoal(irRequest) {
        if (!this.irAction) throw new Error('ir action client is not connected');
        const goal = new ROSLIB.Goal({
            actionClient: this.irAction,
            goalMessage: irRequest,
        });
        this.currentGoal = goal;
        this.result = undeذfined;
        this.attachGoalResult(goal);
        goal.send();
        return goal.goalID;
    }

    attachGoalResult(goal) {
        goal.on('result', result => {
            this.result = result;
        });
    }

    clearGoal() {
        this.currentGoal = null;
        this.result = null;
    }
}
