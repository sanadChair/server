import { SmartHomeRouter } from './routes.js';
import './ros/smart-home.ros.topic.js';
import './ros/smart-home.ros.service.js';
import { smartHomeService } from './smart-home.service.js';
import { ProvisioningRouter } from './provisioning/provisioning.routes.js';
import { provisioningService } from './provisioning/provisioning.service.js';

export const SmartHomeModule = {
    routers: [SmartHomeRouter, ProvisioningRouter],
    services: [smartHomeService, provisioningService],
};

export default SmartHomeModule;
