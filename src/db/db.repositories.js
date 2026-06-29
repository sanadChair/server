import { AppDataSource } from './datasources.js';
import { UserSchema } from './entity/users.entity.js';
import { RoomSchema } from './entity/rooms.entity.js';
import { DevicesSchema } from './entity/devices.entity.js';
import { IRSchema } from './entity/ir.entity.js';

export const dbRepositories = {
    get user() {
        return AppDataSource.getRepository(UserSchema);
    },
    get room() {
        return AppDataSource.getRepository(RoomSchema);
    },
    get device() {
        return AppDataSource.getRepository(DevicesSchema);
    },
    get ir() {
        return AppDataSource.getRepository(IRSchema);
    },
};
