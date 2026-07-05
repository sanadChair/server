import {
    getProvisioningStatus,
    discoverUnprovisioned,
    setHomeWifi,
    targetDevice,
} from './provisioning.controller.js';
import { targetDeviceDto, setHomeWifiDto } from './provisioning.dto.js';

export const ProvisioningRouter = {
    customRouter: true,
    base: '/smart-home/provisioning',
    routes: [
        {
            name: 'getProvisioningStatus',
            description: 'Get current provisioning state, discovered SSIDs, and queue info',
            method: 'GET',
            path: '/status',
            controller: getProvisioningStatus,
            middlewares: [],
        },
        {
            name: 'discoverUnprovisioned',
            description: 'Trigger a single on-demand Wi-Fi scan for new smarthome_[MAC] SSIDs',
            method: 'GET',
            path: '/discover',
            controller: discoverUnprovisioned,
            middlewares: [],
        },
        {
            name: 'setHomeWifi',
            description: 'Set the home router Wi-Fi credentials used when provisioning devices',
            method: 'POST',
            path: '/wifi',
            dto: setHomeWifiDto,
            controller: setHomeWifi,
            middlewares: [],
        },
        {
            name: 'targetDevice',
            description: 'Enqueue a specific discovered device for provisioning (Discovery-First flow)',
            method: 'POST',
            path: '/target',
            dto: targetDeviceDto,
            controller: targetDevice,
            middlewares: [],
        },
    ],
};
