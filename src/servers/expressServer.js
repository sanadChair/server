import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';
import { dataValidation } from '#src/middleware/validationMiddleware.js';
import { globalControllerWrapper } from '#utils/controller.wrapper.js';
import { errorHandler } from '#src/middleware/global.error.handler.middleware.js';

export default class ExpressServer {
    constructor(app) {
        if (ExpressServer.instance) {
            return ExpressServer.instance;
        }

        this.app = app;
        ExpressServer.instance = this;
    }

    reset() {
        ExpressServer.instance = null;
    }

    initializeCoreMiddleware(options) {
        this.app.use(options.cors || cors());
        this.app.use(options.json || express.json());
        this.app.use(options.urlencoded || express.urlencoded({ extended: true }));
        return this;
    }

    attachLogger(logger) {
        if (logger)
            this.app.use(
                morgan(':method :url :status :response-time ms', {
                    stream: {
                        write: message => logger.info(message.trim()),
                    },
                })
            );
        return this;
    }

    mountRoutesAndMiddlewares(routerRegistry, prefix = '/api/v1') {
        for (const routerConfig of routerRegistry) {
            this.attachMiddlewares(routerConfig);
            this.attachRoutes(routerConfig, prefix);
        }
        this.app.use(errorHandler);
        return this;
    }

    attachRoutes(routerConfig, prefix = '/api/v1') {
        const routes = routerConfig.routes || routerConfig;
        const base = routerConfig.base || '';
        if (routerConfig.customRouter) {
            for (const route of routes) {
                const path = prefix + base + (route.path ?? '');
                const handlers = [];
                if (route.dto) {
                    handlers.push(dataValidation(route.dto));
                }
                handlers.push(globalControllerWrapper(route.controller));
                console.log("initializing: ",  route.method,  routerConfig.base + route.path)
                switch (route.method?.toUpperCase()) {
                    case 'GET':
                        this.app.get(path, ...handlers);
                        break;
                    case 'POST':
                        this.app.post(path, ...handlers);
                        break;
                    case 'PUT':
                        this.app.put(path, ...handlers);
                        break;
                    case 'PATCH':
                        this.app.patch(path, ...handlers);
                        break;
                    case 'DELETE':
                        this.app.delete(path, ...handlers);
                        break;
                    default:
                        console.warn(`Unsupported HTTP method: ${route.method} for path ${path}`);
                        break;
                }
            }
        } else {
            this.app.use(prefix, routerConfig);
        }
    }

    attachMiddlewares(routerConfig, prefix = '/api/v1') {
        const routes = routerConfig.routes || routerConfig;
        const base = routerConfig.base || '';
        if (routerConfig.customRouter)
            for (const route of routes) {
                const path = prefix + base + (route.path ?? '');
                if (route.middlewares)
                    for (const middleware of route.middlewares) this.app.use(path, middleware);
            }
    }

    setUpSwaggerDocs(options, prefix = '/api/v1', endpoint = '/docs') {
        this.swaggerDocs = swaggerJsdoc(options);
        if (this.swaggerDocs) {
            this.app.use(
                prefix + endpoint,
                swaggerUiExpress.serve,
                swaggerUiExpress.setup(this.swaggerDocs)
            );
            this.app.get(prefix + endpoint + '.json', (req, res) => res.json(this.swaggerDocs));
        } else throw new Error('cant setup swagger');
        return this;
    }

    getApp() {
        return this.app;
    }
}
