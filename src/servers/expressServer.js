import express from 'express';
import morgan from 'morgan';
import cors from 'cors';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUiExpress from 'swagger-ui-express';
import { dataValidation } from '#src/middleware/validationMiddleware.js';
import { globalControllerWrapper } from '#utils/controller.wrapper.js';
import { errorHandler } from '#src/middleware/global.error.handler.middleware.js';
import { Authenticator } from '#src/middleware/authenticator.middleware.js';
import logger from '#utils/logger.js';

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
            this.attachRoutesAndMiddlewares(routerConfig, prefix);
        }
        this.app.use(errorHandler);
        return this;
    }

    attachRoutesAndMiddlewares(routerConfig, prefix = '/api/v1') {
        const routes = routerConfig.routes || routerConfig;
        const base = routerConfig.base || '';

        if (routerConfig.customRouter) {
            for (const route of routes) {
                const path = prefix + base + (route.path ?? '');
                const handlers = [...this.getMiddlewares(route), this.getController(route)];
                logger.info(`[EXPRESS SERVER] initializing: ${route.method} ${base + route.path}`);

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

    getMiddlewares(route) {
        const middlewares = [];
        if (route.dto) {
            middlewares.push(dataValidation(route.dto));
        }
        if (route.protected) {
            middlewares.push(Authenticator);
        }
        if (route.middlewares) {
            middlewares.push(...route.middlewares);
        }
        return middlewares;
    }

    getController(route) {
        return globalControllerWrapper(route.controller);
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
