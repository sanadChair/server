import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import { telegramService } from '../telegram.service.js';

const parseOptions = options => {
    if (typeof options !== 'string') return options ?? {};

    try {
        return JSON.parse(options);
    } catch {
        return {};
    }
};

const getRequestBody = req => ({
    id: req.id,
    email: req.email || undefined,
    chat: req.chat,
    message: req.message ?? req.text ?? req.data ?? '',
    options: parseOptions(req.options),
});

const advertiseAsync = (service, callback) => {
    if (service.isAdvertised || typeof callback !== 'function') return;

    service.ros.on(service.name, async rosbridgeRequest => {
        const response = {};
        let success = true;

        try {
            success = await callback(rosbridgeRequest.args, response);
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to handle ${service.name}: ${error.message}`);
            success = false;
        }

        const call = {
            op: 'service_response',
            service: service.name,
            values: new ROSLIB.ServiceResponse(response),
            result: success,
        };

        if (rosbridgeRequest.id) call.id = rosbridgeRequest.id;
        service.ros.callOnConnection(call);
    });

    service.ros.callOnConnection({
        op: 'advertise_service',
        type: service.serviceType,
        service: service.name,
    });
    service.isAdvertised = true;
};

const toRosDialog = ({
    id = '',
    name = '',
    title = '',
    unreadCount = 0,
    isUser = false,
    isGroup = false,
    isChannel = false,
    archived = false,
    pinned = false,
} = {}) => ({
    id,
    name,
    title,
    unread_count: unreadCount,
    type: isUser ? 'user' : isGroup ? 'group' : isChannel ? 'channel' : '',
    archived,
    pinned,
});

const toRosMessage = ({
    id = 0,
    chatId = '',
    senderId = '',
    date = 0,
    message = '',
    out = false,
    mentioned = false,
    mediaUnread = false,
    silent = false,
    post = false,
} = {}) => ({
    id,
    chat_id: chatId,
    sender_id: senderId,
    date,
    message,
    out,
    mentioned,
    media_unread: mediaUnread,
    silent,
    post,
});

class TelegramROSService {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            logger.info('[Telegram ROS service] ROS reconnected, refreshing services...');
            this.ros = newRosInstance;
            this.createService();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.createService();
        }
    }

    createService() {
        this.getGroups = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/groups',
            serviceType: 'sanad_interfaces/srv/GetTelegramGroups',
        });
        advertiseAsync(this.getGroups, this.getGroupsCallback.bind(this));

        this.getUsers = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/users',
            serviceType: 'sanad_interfaces/srv/GetTelegramUsers',
        });
        advertiseAsync(this.getUsers, this.getUsersCallback.bind(this));

        this.getMessages = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/messages',
            serviceType: 'sanad_interfaces/srv/GetTelegramMessages',
        });
        advertiseAsync(this.getMessages, this.getMessagesCallback.bind(this));

        this.sendMessage = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/send',
            serviceType: 'sanad_interfaces/srv/SendTelegramMessage',
        });
        advertiseAsync(this.sendMessage, this.sendMessageCallback.bind(this));
    }

    async getGroupsCallback(req, res) {
        try {
            const body = getRequestBody(req);
            const groups = await telegramService.getDialogs(body, body.options, 'groups');
            res.groups = groups.map(toRosDialog);
            return true;
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get groups: ${error.message}`);
            res.groups = [];
            return false;
        }
    }

    async getUsersCallback(req, res) {
        try {
            const body = getRequestBody(req);
            const users = await telegramService.getDialogs(body, body.options, 'users');
            res.users = users.map(toRosDialog);
            return true;
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get users: ${error.message}`);
            res.users = [];
            return false;
        }
    }

    async getMessagesCallback(req, res) {
        try {
            const body = getRequestBody(req);
            const messages = await telegramService.getMessages(body, body.chat, body.options);
            res.messages = messages.map(toRosMessage);
            return true;
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get messages: ${error.message}`);
            res.messages = [];
            return false;
        }
    }

    async sendMessageCallback(req, res) {
        try {
            const body = getRequestBody(req);
            if (!body.message) throw new Error('telegram message is required');
            const message = await telegramService.sendMessage(
                body,
                body.chat,
                body.message,
                body.options
            );
            res.message = toRosMessage(message);
            res.success = true;
            return true;
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to send message: ${error.message}`);
            res.message = toRosMessage({});
            res.success = false;
            return false;
        }
    }
}

export default new TelegramROSService();
