import rosHandler from '#lib/ros/connection.js';
import ROSLIB from 'roslib';
import logger from '#utils/logger.js';
import { telegramManager } from '../telegram.manager.js';

const parseOptions = options => {
    if (!options || typeof options !== 'string') return options || {};

    try {
        return JSON.parse(options);
    } catch (error) {
        return {};
    }
};

const mapToRosDialog = (dialog = {}) => ({
    id: dialog.id || '',
    name: dialog.name || '',
    title: dialog.title || '',
    unread_count: Number(dialog.unreadCount) || 0,
    type:
        (Boolean(dialog.isUser) && 'user') ||
        (Boolean(dialog.isGroup) && 'group') ||
        (Boolean(dialog.isChannel) && 'channel'),
    archived: Boolean(dialog.archived),
    pinned: Boolean(dialog.pinned),
});

const mapToRosMessage = (message = {}) => ({
    id: Number(message.id) || 0,
    chat_id: message.chatId || '',
    sender_id: message.senderId || '',
    date: Number(message.date) || 0,
    message: message.message || '',
    out: Boolean(message.out),
    mentioned: Boolean(message.mentioned),
    media_unread: Boolean(message.mediaUnread),
    silent: Boolean(message.silent),
    post: Boolean(message.post),
});

const getUserData = req => ({
    id: req.id,
    email: req.email,
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
            serviceType: 'sanad_interfaces/telegram/srv/GetTelegramGroups',
        });
        this.getGroups.advertise(this.getGroupsCallback.bind(this));

        this.getUsers = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/users',
            serviceType: 'sanad_interfaces/telegram/srv/GetTelegramUsers',
        });
        this.getUsers.advertise(this.getUsersCallback.bind(this));

        this.getMessages = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/messages',
            serviceType: 'sanad_interfaces/telegram/srv/GetTelegramMessages',
        });
        this.getMessages.advertise(this.getMessagesCallback.bind(this));

        this.sendMessage = new ROSLIB.Service({
            ros: this.ros,
            name: '/telegram/chat/send',
            serviceType: 'sanad_interfaces/telegram/srv/SendTelegramMessage',
        });
        this.sendMessage.advertise(this.sendMessageCallback.bind(this));
    }

    async getGroupsCallback(req, res) {
        try {
            const groups = await telegramManager.getDialogs(
                getUserData(req),
                parseOptions(req.options),
                'groups'
            );
            res.groups = groups.map(mapToRosDialog);
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get groups: ${error.message}`);
            res.groups = [];
        }
        return true;
    }

    async getUsersCallback(req, res) {
        try {
            const users = await telegramManager.getDialogs(
                getUserData(req),
                parseOptions(req.options),
                'users'
            );
            res.users = users.map(mapToRosDialog);
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get users: ${error.message}`);
            res.users = [];
        }
        return true;
    }

    async getMessagesCallback(req, res) {
        try {
            const messages = await telegramManager.getMessages(
                getUserData(req),
                req.chat,
                parseOptions(req.options)
            );
            res.messages = messages.map(mapToRosMessage);
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to get messages: ${error.message}`);
            res.messages = [];
        }
        return true;
    }

    async sendMessageCallback(req, res) {
        try {
            const message = await telegramManager.sendMessage(
                getUserData(req),
                req.chat,
                req.message,
                parseOptions(req.options)
            );
            res.message = mapToRosMessage(message);
            res.success = true;
        } catch (error) {
            logger.warn(`[Telegram ROS service] Failed to send message: ${error.message}`);
            res.message = mapToRosMessage({});
            res.success = false;
        }
        return true;
    }
}

export default new TelegramROSService();
