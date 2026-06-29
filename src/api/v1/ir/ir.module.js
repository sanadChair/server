import { IRRouter } from './routes.js';
import './ros/ir.ros.topic.js';
import './ros/ir.ros.service.js';
import { IRService } from './ir.service.js';

export const RoomModule = {
    routers: [IRRouter],
    services: [IRService],
};
