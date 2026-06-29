import fs from 'fs';
import ExpressServer from '#src/servers/expressServer.js';
import WebsocketServer from '#servers/websocketServer.js';
import logger from '#utils/logger.js';
import { createServer } from 'http';
import express from 'express';

export default class Server {
    constructor() {

        if (Server.instance) return Server.instance;
        this.app = new express();
        this.httpServer = createServer(this.app);

        this.expressServer = new ExpressServer(this.app);
        this.websocketServer = new WebsocketServer(this.httpServer);
    }

    async initializeModules(moduleServices) {
        for (const service of moduleServices) {
            if (service.init) {
                await service.init();
            }
        }
    }

    async initializeDb(AppDataSource) {
        await AppDataSource.initialize();
    }

    async initialize(AppDataSource, ServiceRegistry) {
        await this.initializeDb(AppDataSource);
        await this.initializeModules(ServiceRegistry);
    }

    reset() {
        Server.instance = null;
        this.expressServer.reset();
        this.websocketServer.reset();
    }

    configureExpress(options) {
        this.expressServer
            .initializeCoreMiddleware({
                cors: options.cors,
                json: options.json,
                urlencoded: options.urlencoded,
            })
            .attachLogger(options.logger)
            .setUpSwaggerDocs(
                options.docs.swaggerOptions,
                options.docs.prefix,
                options.docs.endpoint
            );
    }

    configureWS(options) {
        this.websocketServer.createWS(options);
    }

    registerModules(modules) {
        this.expressServer.mountRoutesAndMiddlewares(
            modules.routes.RouterRegistry,
            modules.routes.prefix
        );
        this.websocketServer.registerCallback(modules.callback);
    }

    start(info) {
        this.httpServer.listen(info.port, info.host, () => {
            logger.info(`HTTP & WS running on http://${info.host}:${info.port}`);
            logger.info(`Active connections: ${this.websocketServer.getConnectionCount()}`);
        });
    }
}
