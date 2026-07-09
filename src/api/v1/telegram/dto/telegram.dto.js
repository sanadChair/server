import z from 'zod';

export const NeedTelegramOtp = {
    body: z.object({
        phoneNumber: z.string(),
    }),
};

export const StartTelegramSession = {
    body: z
        .object({
            id: z.union([z.string(), z.number()]).optional(),
            email: z.email().optional(),
        })
        .refine(data => data.id || data.email, {
            message: 'id or email is required',
        }),
};

export const GetTelegramChats = {
    body: z
        .object({
            id: z.union([z.string(), z.number()]).optional(),
            email: z.email().optional(),
            options: z.any().optional(),
        })
        .refine(data => data.id || data.email, {
            message: 'id or email is required',
        }),
};

export const GetTelegramMessages = {
    body: z
        .object({
            id: z.union([z.string(), z.number()]).optional(),
            email: z.email().optional(),
            chat: z.union([z.string(), z.number()]),
            options: z.any().optional(),
        })
        .refine(data => data.id || data.email, {
            message: 'id or email is required',
        }),
};

export const SendTelegramMessage = {
    body: z
        .object({
            id: z.union([z.string(), z.number()]).optional(),
            email: z.email().optional(),
            chat: z.union([z.string(), z.number()]),
            message: z.string(),
            options: z.any().optional(),
        })
        .refine(data => data.id || data.email, {
            message: 'id or email is required',
        }),
};

export const PostTelegramCode = {
    body: z.object({
        phoneNumber: z.string(),
        otp: z.string().min(1),
    }),
};
