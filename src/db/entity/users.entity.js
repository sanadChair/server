import { EntitySchema } from 'typeorm';

export const UserSchema = new EntitySchema({
    name: 'users',
    columns: {
        id: {
            primary: true,
            type: 'integer',
            generated: 'increment',
        },
        name: {
            type: 'text',
        },
        email: {
            type: 'text',
            unique: true,
        },
        password: {
            type: 'text',
        },
        is_dev_user: {
            type: 'boolean',
        },
        telegram_number: {
            type: 'text',
        },
        telegram_session: {
            type: 'text',
            nullable: true,
        },
    },
});
