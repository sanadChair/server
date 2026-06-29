import { EntitySchema } from 'typeorm';

export const IRSchema = new EntitySchema({
    name: 'rooms',
    columns: {
        id: {
            type: 'text',
            primary: true,
            generated: 'uuid',
        },
        device_name: {
            type: 'text',
            unique: true,
        },
        pose: {
            type: 'simple-json',
        },
        keys: {
            type: 'simple-json',
        },
        created_at: {
            type: 'datetime',
            nullable: false,
            createDate: true,
        },
        updated_at: {
            type: 'datetime',
            nullable: false,
            updateDate: true,
        },
    },
});
