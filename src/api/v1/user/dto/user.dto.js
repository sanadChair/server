import z from 'zod';

export const createUserDto = {
    body: z.object({
        name: z.string(),
        email: z.email(),
        password: z.string(),
        is_dev_user: z.boolean(),
        telegram_number: z.string(),
    }),
};

export const getUserDto = {
    body: z.object({
        email: z.string(),
    }),
};
