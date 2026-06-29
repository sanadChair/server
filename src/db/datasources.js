import "reflect-metadata";
import { DataSource } from 'typeorm';
import { UserSchema } from './entity/users.entity.js';
import { RoomSchema } from './entity/rooms.entity.js';
import { DevicesSchema } from './entity/devices.entity.js';
import { IRSchema } from "./entity/ir.entity.js";

export const AppDataSource = new DataSource({
	type: "sqlite",
	database: "database.sqlite",
	synchronize: true,
	logging: false,
	entities: [UserSchema, RoomSchema, DevicesSchema, IRSchema]
});