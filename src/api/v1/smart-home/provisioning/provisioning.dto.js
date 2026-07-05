import z from 'zod';

export const targetDeviceDto = {
    body: z.object({
        macAddress: z
            .string()
            .min(1, 'macAddress is required')
            .max(64)
            .regex(/^[A-Za-z0-9:_-]+$/, 'macAddress must be a valid MAC-like identifier'),
        deviceName: z
            .string()
            .min(1, 'deviceName is required')
            .max(32, 'deviceName must be 32 characters or fewer (ESP32 firmware limit)'),
        roomId: z.string().uuid().optional(),
        controlType: z.string().max(64).optional(),
    }),
};

export const setHomeWifiDto = {
    body: z.object({
        ssid: z
            .string()
            .min(1, 'ssid is required')
            .max(32, 'ssid must be 32 characters or fewer'),
        password: z
            .string()
            .min(8, 'password must be at least 8 characters')
            .max(64, 'password must be 64 characters or fewer'),
    }),
};
