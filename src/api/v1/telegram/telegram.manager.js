import { telegramConnectionManager } from './telegram.connection.manager.js';

class TelegramManager {
    async getDialogs(userData, options = {}, type) {
        const client = await telegramConnectionManager.getClient(userData);
        const dialogs = await client.getDialogs(options);
        const filteredDialogs = dialogs.filter(dialog => {
            if (type === 'users') return dialog.isUser;
            if (type === 'groups') return dialog.isGroup || dialog.isChannel;
            return true;
        });
        return filteredDialogs.map(dialog => this.formatDialog(dialog));
    }

    async getMessages(userData, chat, options = {}) {
        const client = await telegramConnectionManager.getClient(userData);
        const messages = await client.getMessages(chat, options);
        return messages.map(message => this.formatMessage(message));
    }

    async sendMessage(userData, chat, message, options = {}) {
        const client = await telegramConnectionManager.getClient(userData);
        const sentMessage = await client.sendMessage(chat, {
            ...options,
            message,
        });
        return this.formatMessage(sentMessage);
    }

    formatId(id) {
        if (id === undefined || id === null) return id;
        return id.toString();
    }

    formatDialog(dialog) {
        return {
            id: this.formatId(dialog.id),
            name: dialog.name,
            title: dialog.title,
            unreadCount: dialog.unreadCount,
            isUser: dialog.isUser,
            isGroup: dialog.isGroup,
            isChannel: dialog.isChannel,
            archived: dialog.archived,
            pinned: dialog.pinned,
        };
    }

    formatMessage(message) {
        return {
            id: message.id,
            chatId: this.formatId(message.chatId),
            senderId: this.formatId(message.senderId),
            date: message.date,
            message: message.message,
            out: message.out,
            mentioned: message.mentioned,
            mediaUnread: message.mediaUnread,
            silent: message.silent,
            post: message.post,
        };
    }
}

export const telegramManager = new TelegramManager();
