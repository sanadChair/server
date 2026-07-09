import { telegramConnectionManager } from './telegram.connection.manager.js';

const toStringId = id => id?.toString();

const toDialog = dialog => ({
    id: toStringId(dialog.id),
    name: dialog.name,
    title: dialog.title,
    unreadCount: dialog.unreadCount,
    isUser: dialog.isUser,
    isGroup: dialog.isGroup,
    isChannel: dialog.isChannel,
    archived: dialog.archived,
    pinned: dialog.pinned,
});

const toMessage = message => ({
    id: message.id,
    chatId: toStringId(message.chatId),
    senderId: toStringId(message.senderId),
    date: message.date,
    message: message.message,
    out: message.out,
    mentioned: message.mentioned,
    mediaUnread: message.mediaUnread,
    silent: message.silent,
    post: message.post,
});

const normalizeDialogOptions = ({ offsetDate, ...options } = {}) => {
    if (offsetDate) options.offsetDate = offsetDate;
    return options;
};

class TelegramService {
    async getDialogs(userData, options = {}, type) {
        const client = await telegramConnectionManager.getClient(userData);
        const dialogs = await client.getDialogs(normalizeDialogOptions(options));
        return dialogs
            .filter(dialog => {
                if (type === 'users') return dialog.isUser;
                if (type === 'groups') return dialog.isGroup || dialog.isChannel;
                return true;
            })
            .map(toDialog);
    }

    async getMessages(userData, chat, options = {}) {
        const client = await telegramConnectionManager.getClient(userData);
        const messages = await client.getMessages(chat, options);
        return messages.map(toMessage);
    }

    async sendMessage(userData, chat, message, options = {}) {
        const client = await telegramConnectionManager.getClient(userData);
        return toMessage(await client.sendMessage(chat, { ...options, message }));
    }
}

export const telegramService = new TelegramService();
export default TelegramService;
