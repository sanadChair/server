import { dbRepositories } from '#src/db/db.repositories.js';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { OTPManager } from './OTPManager.js';

class TelegramConnectionManager {
    clients = {};

    async getUser(userData) {
        let user = {};
        if (userData.email) {
            user = await dbRepositories.user.findOne({ where: { email: userData.email } });
        } else if (userData.id) {
            user = await dbRepositories.user.findOne({ where: { id: userData.id } });
        } else {
            throw new Error(
                `user id or email must be provided to connect to the current user telegram`
            );
        }
        if (!user) {
            throw new Error(`user ${userData.id ?? userData.email} is not found`);
        }
        return user;
    }

    createClient(sessionString = '') {
        const apiId = Number(process.env.API_ID);
        const apiHash = process.env.API_HASH;
        const session = new StringSession(sessionString);
        return new TelegramClient(session, apiId, apiHash, {
            connectionRetries: 5,
        });
    }

    async getClient(userData) {
        const user = await this.getUser(userData);
        if (!user.telegram_session) {
            throw new Error('telegram session is not created for this user');
        }
        if (this.clients[user.id]?.connected) {
            return this.clients[user.id];
        }
        const client = this.createClient(user.telegram_session);
        await client.connect();
        this.clients[user.id] = client;
        return client;
    }

    async startSession(userData) {
        const user = await this.getUser(userData);
        if (this.clients[user.id]?.connected) {
            return this.clients[user.id];
        }
        if (user.telegram_session) {
            const client = this.createClient(user.telegram_session);
            await client.connect();
            this.clients[user.id] = client;
            return client;
        }
        return await this.createTelegramSession(user);
    }

    async createTelegramSession(user) {
        const client = this.createClient();

        await client.start({
            phoneNumber: async () => user.telegram_number,
            phoneCode: async () => {
                const pendingSession = OTPManager.addPendingSession(user.telegram_number);
                return await pendingSession.pendingOtp;
            },
            onError: err => {
                OTPManager.rejectPendingSession(user.telegram_number, err);
                return true;
            },
        });

        const sessionString = client.session.save();
        await dbRepositories.user.update({ id: user.id }, { telegram_session: sessionString });
        this.clients[user.id] = client;
        OTPManager.resolvePendingSession(user.telegram_number, sessionString);
        return client;
    }

    setClient(userId, client) {
        this.clients[userId] = client;
    }
}

export const telegramConnectionManager = new TelegramConnectionManager();
