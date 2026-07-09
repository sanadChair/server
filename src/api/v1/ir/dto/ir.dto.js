import z from 'zod';

export const getDeviceDto = {
    query: z.object({
        deviceName: z.string(),
    }),
};

export const getAllDevicesDto = {};

export const createDeviceDto = {
    body: z.object({
        deviceName: z.string(),
        pose: z.object({
            x: z.number(),
            y: z.number(),
            yaw: z.number(),
        }),
        keys: z.object({}).optional(),
    }),
};

export const deleteDeviceDto = {
    query: z.object({
        deviceName: z.string(),
    }),
};

export const updateDeviceKeysDto = {
    body: z.object({
        deviceName: z.string(),
        keys: z.object({}),
    }),
};

export const listenToKey = {
    body: z.object({
        deviceName: z.string(),
        keyName: z.string(),
        timeoutMs: z.number().positive().optional(),
    }),
};
