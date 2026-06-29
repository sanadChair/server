import { TelegramRouter } from './routes.js';
import './ros/telegram.ros.service.js';

export const TelegramModule = {
    routers: [TelegramRouter],
    services: [],
};
