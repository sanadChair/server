import z from 'zod';

export const createUserDto = {
    body: z.object({
        name: z.string(),
        email: z.email(),
        password: z.string().min(8, 'password must be at least 8 characters'),
        is_dev_user: z.boolean(),
        telegram_number: z.string(),
    }),
};

export const getUserDto = {
    body: z
        .object({
            id: z.union([z.string(), z.number()]).optional(),
            email: z.email().optional(),
        })
        .refine(data => data.id || data.email, {
            message: 'id or email is required',
        }),
};
