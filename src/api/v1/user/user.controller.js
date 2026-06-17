import { userService } from './user.service.js';

export class UserController {
    static async getUser(req, res) {
        const user = await userService.getUser(req.body);
        return user;
    }

    static async createUser(req, res) {
        return await userService.createUser(req.body);
    }
}
