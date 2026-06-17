import { dbRepositories } from '#src/db/db.repositories.js';

class UserDB {
    async createUser(userObj) {
        const user = dbRepositories.user.create(userObj);
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
