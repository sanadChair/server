import { userDb } from './user.db.js';

class UserService {
    async createUser(userData) {
        return await userDb.createUser(userData);
    }

    async getUser(userUniqueData) {
        let user = {};
        if (userUniqueData.email) user = await userDb.getUserByEmail(userUniqueData.email);
        else if (userUniqueData.id) user = await userDb.getUserById(userUniqueData.id);
        else
            throw new Error(`can't query users using ${Object.keys(userUniqueData) ?? 'no'} field`);
        if (!user) throw new Error(`user ${userUniqueData.email ?? userUniqueData.id} not found`);
        delete user.telegram_session;
        return user;
    }
}

export const userService = new UserService();
