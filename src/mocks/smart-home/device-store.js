import fs from 'fs';
import { fileURLToPath } from 'url';
import logger from '../../utils/logger.js';
import { AppDataSource } from '../../db/datasources.js';
import { dbRepositories } from '../../db/db.repositories.js';

const DEVICES_FILE = fileURLToPath(new URL('./smart-dev.json', import.meta.url));
const DEFAULT_PORT = Number(process.env.SMART_DEV_PORT || 19803);

class MockSmartHomeDeviceStore {
    constructor() {
        this.devices = {};
        this.dbReady = false;
        this.loadFromJson();
    }

    async init() {
        await this.refreshFromDb();
        this.writeJson();
        return this.getAllDevices();
    }

    normalizeDevice(device = {}) {
        const id = device.id ?? device.deviceId;
        if (!id) return null;

        return {
            deviceId: id,
            id,
            name: device.name ?? id,
            control_type: device.control_type ?? 'binary',
            state: Number(device.state ?? 0),
            connected: device.connected ?? true,
            port: Number(device.port ?? DEFAULT_PORT),
            ...(device.room ? { room: device.room } : {}),
        };
    }

    loadFromJson() {
        try {
            const parsed = JSON.parse(fs.readFileSync(DEVICES_FILE, 'utf8'));
            const rawDevices = parsed.devices ?? parsed;
            const deviceList =
                rawDevices.id || rawDevices.deviceId
                    ? [rawDevices]
                    : Array.isArray(rawDevices)
                      ? rawDevices
                      : Object.values(rawDevices);
            this.devices = {};

            for (const rawDevice of deviceList) {
                const device = this.normalizeDevice(rawDevice);
                if (device) this.devices[device.id] = device;
            }
        } catch (err) {
            logger.warn(`[MOCK SMART HOME] Failed to read smart-dev.json: ${err.message}`);
            this.devices = {};
        }
    }

    async ensureDb() {
        if (this.dbReady) return true;

        try {
            if (!AppDataSource.isInitialized) {
                await AppDataSource.initialize();
            }
            this.dbReady = true;
            return true;
        } catch (err) {
            logger.warn(`[MOCK SMART HOME] Failed to initialize DB: ${err.message}`);
            return false;
        }
    }

    async refreshFromDb() {
        if (!(await this.ensureDb())) return this.getAllDevices();

        let dbDevices;
        try {
            dbDevices = await dbRepositories.device.find({ relations: { room: true } });
        } catch (err) {
            logger.warn(`[MOCK SMART HOME] Failed to read DB devices: ${err.message}`);
            return this.getAllDevices();
        }

        if (!dbDevices.length) return this.getAllDevices();

        const previousDevices = this.devices;
        this.devices = {};
        for (const rawDevice of dbDevices) {
            const previous = previousDevices[rawDevice.id];
            const device = this.normalizeDevice({
                ...rawDevice,
                state: previous?.state ?? rawDevice.state,
                port: previous?.port ?? DEFAULT_PORT,
                connected: true,
            });
            if (device) this.devices[device.id] = device;
        }

        this.writeJson();
        logger.info(`[MOCK SMART HOME] Loaded ${dbDevices.length} device(s) from DB`);
        return this.getAllDevices();
    }

    getAllDevices() {
        return this.devices;
    }

    async findDevice(id) {
        await this.refreshFromDb();
        return this.devices[id];
    }

    writeJson() {
        const snapshot = {
            source: 'database.sqlite',
            updated_at: new Date().toISOString(),
            devices: this.devices,
        };

        fs.writeFileSync(
            DEVICES_FILE,
            `${JSON.stringify(snapshot, null, 2)}\n`
        );
    }

    async updateState(id, state) {
        const device = await this.findDevice(id);
        if (!device) return null;

        device.state = Number(state);
        this.devices[id] = device;
        this.writeJson();
        return device;
    }

    async updateName(id, name) {
        const device = await this.findDevice(id);
        if (!device) return null;

        device.name = name;
        this.devices[id] = device;
        this.writeJson();
        return device;
    }

    async removeDevice(id) {
        await this.refreshFromDb();
        const device = this.devices[id];
        delete this.devices[id];
        this.writeJson();
        return device;
    }
}

export const mockSmartHomeDeviceStore = new MockSmartHomeDeviceStore();
