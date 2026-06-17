import { UserRouter } from './routes.js';
import { userService } from './user.service.js';

export const UserModule = {
    routers: [UserRouter],
    services: [userService],
};
