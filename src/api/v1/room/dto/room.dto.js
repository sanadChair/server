import { z } from 'zod';

export const registerRoomDto = {
    body: z.object({
        id: z.uuid(),
        name: z.string(),
        min_x: z.number(),
        max_x: z.number(),
        min_y: z.number(),
        max_y: z.number(),
        theta: z.number(),
        pose_x: z.number(),
        pose_y: z.number(),
        pose_theta: z.number(),
    }),
};

export const updateRoomDto = {
    body: z.object({
        id: z.uuid(),
        name: z.string().optional(),
        min_x: z.number().optional(),
        max_x: z.number().optional(),
        min_y: z.number().optional(),
        max_y: z.number().optional(),
        theta: z.number().optional(),
        pose_x: z.number().optional(),
        pose_y: z.number().optional(),
        pose_theta: z.number().optional(),
    }),
};

export const getRoomDto = {
    params: z.object({
        id: z.string(),
    }),
};

export const deleteRoomDto = {
    params: z.object({
        id: z.string(),
    }),
};

export const navigateToRoomDto = {
    params: z.object({
        id: z.string(),
    }),
};
