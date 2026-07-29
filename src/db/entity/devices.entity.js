import { EntitySchema } from 'typeorm';

export const DevicesSchema = new EntitySchema({
    name: 'devices',
    columns: {
        id: {
            type: 'text',
            primary: true,
        },
        name: {
            type: 'text',
            nullable: false,
        },
        control_type: {
            type: 'text',
            nullable: false,
        },
        state: {
            type: 'integer',
            nullable: false,
            default: 0,
        },
        connected: {
            type: 'boolean',
            nullable: false,
            default: false,
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
    relations: {
        room: {
            type: 'many-to-one',
            target: 'rooms',
            joinColumn: true,
            inverseSide: 'devices',
            nullable: true,
        },
    },
});
