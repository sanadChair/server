import { OTPManager } from './otp.manager.js';
import { telegramConnectionManager } from './telegram.connection.manager.js';
import { telegramManager } from './telegram.manager.js';

export class TelegramController {
    static async needsOTP(req, res) {
        return OTPManager.hasAPendingSession(req.body.phoneNumber);
    }
    static async postCode(req, res) {
        const { phoneNumber, otp } = req.body;
        const pendingSession = OTPManager.getPendingSession(phoneNumber);
        OTPManager.resolveOtpCode(phoneNumber, otp);
        try {
            await pendingSession.pendingSession;
        } catch (err) {
            throw new Error(`Telegram session failed: ${err.message}`);
        }
        return 'session connected';
    }

    static async startSession(req, res) {
        await telegramConnectionManager.startSession(req.body);
        return 'session connected';
    }

    static async getGroups(req, res) {
        return await telegramManager.getDialogs(req.body, req.body.options, 'groups');
    }

    static async getUsers(req, res) {
        return await telegramManager.getDialogs(req.body, req.body.options, 'users');
    }

    static async getMessages(req, res) {
        return await telegramManager.getMessages(req.body, req.body.chat, req.body.options);
    }

    static async sendMessage(req, res) {
        return await telegramManager.sendMessage(
            req.body,
            req.body.chat,
            req.body.message,
            req.body.options
        );
    }
}
