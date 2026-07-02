import { userDb } from './user.db.js';

class UserService {
    async createUser(userData) {
        const user = await userDb.createUser(userData);
        return this.#formatUser(user);
    }

    async getUser(userUniqueData) {
        let user;
        if (userUniqueData.email) user = await userDb.getUserByEmail(userUniqueData.email);
        else if (userUniqueData.id) user = await userDb.getUserById(userUniqueData.id);
        else
            throw new Error(`can't query users using ${Object.keys(userUniqueData) ?? 'no'} field`);
        if (!user) throw new Error(`user ${userUniqueData.email ?? userUniqueData.id} not found`);
        return this.#formatUser(user);
    }

    #formatUser(user) {
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            is_dev_user: user.is_dev_user,
            telegram_number: user.telegram_number,
        };
    }
}

export const userService = new UserService();
