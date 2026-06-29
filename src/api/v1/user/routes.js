import { createUserDto, getUserDto } from './dto/user.dto.js';
import { UserController } from './user.controller.js';

export const UserRouter = {
    customRouter: true,
    base: '/user',
    routes: [
        {
            name: 'get user',
            description: 'get one user data using email or id',
            method: 'GET',
            path: '/',
            controller: UserController.getUser,
            dto: getUserDto,
            protected: true,
            middlewares: [],
        },
        {
            name: 'create user',
            description: 'create new user',
            method: 'POST',
            path: '/',
            controller: UserController.createUser,
            dto: createUserDto,
            middlewares: [],
        },
    ],
};
