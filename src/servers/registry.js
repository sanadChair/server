import { MapModule } from '#modules/map/map.module.js';
import { WheelchairModule } from '#modules/wheelchair/wheelchair.module.js';
import { PoseModule } from '#modules/pose/pose.module.js';
import { GoalModule } from '#modules/goal/goal.module.js';
import { SmartHomeModule } from '#modules/smart-home/smart-home.module.js';
import { RoomModule } from '#src/api/v1/room/room.module.js';
import { TelegramModule } from '#src/api/v1/telegram/telegram.module.js';
import { UserModule } from '#src/api/v1/user/user.module.js';

export const CallbackRegistry = [
    ...MapModule.WSCallback,
    ...WheelchairModule.WSCallback,
    ...PoseModule.WSCallback,
    ...GoalModule.WSCallback,
];

export const RouterRegistry = [
    ...RoomModule.routers,
    ...MapModule.routers,
    ...WheelchairModule.routers,
    ...PoseModule.routers,
    ...GoalModule.routers,
    ...SmartHomeModule.routers,
    ...TelegramModule.routers,
    ...UserModule.routers,
];

// for async init of services on the modules
export const ServiceRegistry = [
	...RoomModule.services,
	...SmartHomeModule.services,
	...TelegramModule.services,
	...UserModule.services,
]
