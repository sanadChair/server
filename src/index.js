import dotenv from 'dotenv';
import logger from '#utils/logger.js';
import Server from '#servers/server.js';
import { swaggerOptions } from '../swagger.options.js';
import { RouterRegistry } from '#servers/registry.js';
import { CallbackRegistry } from '#servers/registry.js';
import { ServiceRegistry } from './servers/registry.js';
import { AppDataSource } from './db/datasources.js';

dotenv.config();
// Trigger nodemon reload for .env changes

const PORT = process.env.SERVER_PORT || 5051;
const HOST = process.env.SERVER_HOSTNAME || 'localhost';

const server = new Server();

server.configureExpress({
    logging: logger,
    docs: {
        swaggerOptions,
        prefix: '/api/v1',
        endpoint: '/docs',
    },
});

server.configureWS({
    cors: '*',
});

server.registerModules({
    routes: {
        RouterRegistry,
        prefix: '/api/v1',
    },
    callback: CallbackRegistry,
});

server.initialize(AppDataSource, ServiceRegistry).then(_ => {
    server.start({
        host: HOST,
        port: PORT,
    });
});
