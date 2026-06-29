# Developer Guide

This guide documents the current SANAD Server structure and the conventions to follow when adding or changing modules.

## Runtime Flow
1. `src/index.js` loads environment variables.
2. `Server` configures Express, Swagger, Socket.IO, and the HTTP server.
3. `src/servers/registry.js` provides:
   - `RouterRegistry` for HTTP routes
   - `CallbackRegistry` for Socket.IO callbacks
   - `ServiceRegistry` for services with async `init()` hooks
4. TypeORM initializes `database.sqlite`.
5. Module services are initialized.
6. The HTTP and Socket.IO server starts.

## Module Layout
A typical module lives under `src/api/v1/<module>/`:

```text
<module>/
  routes.js
  <module>.module.js
  <module>.controller.js
  <module>.service.js
  dto/
    <module>.dto.js
  ros/
    <module>.ros.service.js
    <module>.ros.topic.js
    <module>.ros.action.js
```

Use only the files the module needs. Not every module has ROS, DTOs, services, or Socket.IO callbacks.

## Route Pattern
Most new modules use custom route objects:

```js
export const FeatureRouter = {
    customRouter: true,
    base: '/feature',
    routes: [
        {
            name: 'create feature',
            description: 'create a feature',
            method: 'POST',
            path: '/',
            dto: createFeatureDto,
            protected: true,
            controller: FeatureController.create,
            middlewares: [],
        },
    ],
};
```

The final path is `/api/v1` + `base` + `path`.

Use `protected: true` when the route needs `Authenticator`. Add Zod DTOs through the `dto` field. Controllers should return data and let `globalControllerWrapper` handle the HTTP response and errors.

Older modules may still export an Express router directly. Both patterns are supported by `ExpressServer`.

## Controller And Service Pattern
Controllers should be thin:

```js
export class FeatureController {
    static async create(req, res) {
        return await featureService.create(req.body);
    }
}
```

Services own business logic and database calls. If a service needs initialization during startup, export an instance and add it to the module's `services` array:

```js
export const FeatureModule = {
    routers: [FeatureRouter],
    services: [featureService],
};
```

The server calls `init()` on services that define it.

## DTO Pattern
DTO files use Zod:

```js
import z from 'zod';

export const createFeatureDto = {
    body: z.object({
        name: z.string(),
    }),
};
```

Supported validation locations depend on `validationMiddleware`, but current modules use `body`, `query`, and route params patterns.

## Database Pattern
Database access uses TypeORM repositories from `src/db/db.repositories.js`.

Prefer the repository methods already used in the project:

```js
await dbRepositories.user.findOne({ where: { id } });
await dbRepositories.user.insert(entity);
await dbRepositories.device.save(entity);
await dbRepositories.device.update({ id }, updateData);
await dbRepositories.device.delete({ id });
```

Entities live in `src/db/entity/`, and the datasource is defined in `src/db/datasources.js`.

## ROS Pattern
ROS connection is centralized in `src/lib/ros/connection.js`. It connects to:

```text
ws://ROSBRIDGE_HOST:ROSBRIDGE_PORT
```

ROS modules usually import `rosHandler`, create `ROSLIB.Topic`, `ROSLIB.Service`, or action clients, and recreate them when `ros_reconnected` fires.

Service files commonly follow this shape:

```js
class FeatureROSService {
    constructor() {
        rosHandler.on('ros_reconnected', newRosInstance => {
            this.ros = newRosInstance;
            this.createService();
        });

        if (rosHandler.isConnected()) {
            this.ros = rosHandler.getRos();
            this.createService();
        }
    }
}

export default new FeatureROSService();
```

Import ROS files from the module file for side effects when they should initialize on startup.

## Socket.IO Pattern
Socket.IO callbacks are registered through `CallbackRegistry`. A callback object has:

```js
export const featureCallback = {
    publish: [],
    subscribe: [],
    broadcast: [],
    cleanup: socket => {},
};
```

Current active public event support is wheelchair velocity. See `SOCKETIO.DOCS.README.md`.

## Current Registered Modules
`src/servers/registry.js` currently registers:

- `room`
- `map`
- `wheelchair`
- `pose`
- `goal`
- `smart-home`
- `telegram`
- `user`

The `ir` module exists but should be checked before registration because parts of it are still in progress.

## Related Docs
- `LOGGING.DOCS.README.md`
- `SOCKETIO.DOCS.README.md`
- Root `README.md`
