import { EntitySchema } from 'typeorm';

export const RoomSchema = new EntitySchema({
    name: 'rooms',
    columns: {
        id: {
            type: 'text',
            primary: true,
            generated: 'uuid',
        },
        name: {
            type: 'text',
            unique: true,
        },
        min_x: {
            type: 'real',
        },
        min_y: {
            type: 'real',
        },
        max_x: {
            type: 'real',
        },
        max_y: {
            type: 'real',
        },
        theta: {
            type: 'real',
            default: 0.0,
        },
        pose_x: {
            type: 'real',
        },
        pose_y: {
            type: 'real',
        },
        pose_theta: {
            type: 'real',
            default: 0.0,
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
        devices: {
            type: 'one-to-many',
            target: 'devices',
            inverseSide: 'room',
            cascade: true,
        },
    },
});
