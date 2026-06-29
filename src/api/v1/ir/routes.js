import { IRController } from './ir.controller.js';
import {
    createDeviceDto,
    deleteDeviceDto,
    getAllDevicesDto,
    getDeviceDto,
    listenToKey,
    updateDeviceKeysDto,
} from './dto/ir.dto.js';

export const IRRouter = {
    customRouter: true,
    base: '/ir',
    routes: [
        {
            name: 'get device',
            description: 'get one device',
            method: 'GET',
            path: '/device',
            dto: getDeviceDto,
            controller: IRController.getDevice,
            middlewares: [],
        },
        {
            name: 'get all devices',
            description: 'get all devices',
            method: 'GET',
            path: '/devices',
            dto: getAllDevicesDto,
            controller: IRController.getAllDevices,
            middlewares: [],
        },
        {
            name: 'create device',
            description: 'create device',
            method: 'POST',
            path: '/device',
            dto: createDeviceDto,
            controller: IRController.createDevice,
            middlewares: [],
        },
        {
            name: 'delete device',
            description: 'delete device',
            method: 'DELETE',
            path: '/device',
            dto: deleteDeviceDto,
            controller: IRController.deleteDevice,
            middlewares: [],
        },
        {
            name: 'update device keys',
            description: 'update device keys',
            method: 'PATCH',
            path: '/device/keys',
            dto: updateDeviceKeysDto,
            controller: IRController.updateDeviceKeys,
            middlewares: [],
        },
        {
            name: 'detect key',
            description: 'use ros side to detect the ir code using the device',
            method: 'POST',
            path: '/device/keys',
            dto: listenToKey,
            controller: IRController.listenToKeys,
        },
    ],
};
