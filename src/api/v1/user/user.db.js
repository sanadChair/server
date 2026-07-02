import bcrypt from 'bcryptjs';
import { dbRepositories } from '#src/db/db.repositories.js';

const SALT_ROUNDS = 10;

class UserDB {
    async createUser(userObj) {
        const existing = await dbRepositories.user.findOne({ where: { email: userObj.email } });
        if (existing) {
            throw new Error(`a user with email "${userObj.email}" already exists`);
        }
        const hashedPassword = await bcrypt.hash(userObj.password, SALT_ROUNDS);
        const user = dbRepositories.user.create({ ...userObj, password: hashedPassword });
        const result = await dbRepositories.user.insert(user);
        return { ...user, id: result.identifiers[0]?.id };
    }

    async getUserById(userid) {
        return await dbRepositories.user.findOne({ where: { id: userid } });
    }

    async getUserByEmail(email) {
        return await dbRepositories.user.findOne({ where: { email } });
    }
}

export const userDb = new UserDB();
