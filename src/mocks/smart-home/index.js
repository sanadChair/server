import express from 'express';
import 'dotenv/config';
import process from 'process';
import bodyParser from 'body-parser';
import logger from '../../utils/logger.js';
import { mockDeviceDiscovery } from './discovery.js';
import mockSmartHomeRouter from './routes.js';
import { mockSmartHomeDeviceStore } from './device-store.js';

const PORT = process.env.SMART_DEV_PORT || 19803 ;
const app = express();

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());
app.use(mockSmartHomeRouter);

mockSmartHomeDeviceStore.init().then(devices => {
    logger.info(`loaded device data: ${JSON.stringify(devices)}`);
    logger.info(`loaded discovery data: ${JSON.stringify(mockDeviceDiscovery.specs)}`);

    const server = app.listen(PORT, () => {
        logger.info(`[MOCK SMARTHOME SERVER]: server starting at port ${PORT}`);
    });

    server.on('error', err => {
        logger.error(`[MOCK SMARTHOME SERVER]: failed to listen on port ${PORT}: ${err.message}`);
        process.exit(1);
    });
});
