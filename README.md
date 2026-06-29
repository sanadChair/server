# SANAD Server

## Overview
SANAD Server is the Node.js backend for the SANAD graduation project. It connects REST APIs, Socket.IO clients, the SQLite database, Telegram integration, smart-home discovery/control, and ROS2 through rosbridge.

The server exposes HTTP routes under `/api/v1`, real-time Socket.IO events on the same HTTP server, and ROS topic/service/action adapters through `roslib`.

## Prerequisites
- Node.js 16 or newer
- npm
- ROS2
- `rosbridge_suite`
- SQLite, used through TypeORM
- Telegram API credentials when using Telegram features

## Installation

```bash
git clone <repository-url>
cd server
npm install
```

## Configuration
Create a `.env` file in the project root using `.env.example` as the template.

Important values:

```env
SERVER_HOSTNAME=0.0.0.0
SERVER_PORT=5051
ROSBRIDGE_HOST=localhost
ROSBRIDGE_PORT=9090
API_ID=<telegram-api-id>
API_HASH=<telegram-api-hash>
```

Install and run rosbridge for ROS2:

```bash
sudo apt update
sudo apt install ros-$ROS_DISTRO-rosbridge-suite
ros2 launch rosbridge_server rosbridge_websocket_launch.xml
```

The server also checks for an IRDB folder. If you use IR features, run:

```bash
npm run setup:irdb
```

## Running

```bash
npm run dev
npm test
```

The configured HTTP and Socket.IO server starts on:

```text
http://<SERVER_HOSTNAME>:<SERVER_PORT>
```

Swagger UI is available at:

```text
http://<host>:<port>/api/v1/docs
```

The raw Swagger JSON is available at:

```text
http://<host>:<port>/api/v1/docs.json
```

## Current Modules
- `room`: room CRUD, navigation requests, ROS room services/topics
- `smart-home`: device discovery, control, room assignment, ROS services/topics
- `telegram`: session-backed Telegram chat APIs and ROS services for basic chat functions
- `user`: user creation and lookup
- `goal`: navigation goal routes and ROS action/service integration
- `wheelchair`: velocity REST and Socket.IO control
- `map`: map retrieval from ROS
- `pose`: pose retrieval from ROS
- `ir`: IR device storage and ROS service/action work in progress

## API Shape
Most newer modules use custom route objects:

```js
export const ExampleRouter = {
    customRouter: true,
    base: '/example',
    routes: [
        {
            name: 'example action',
            method: 'POST',
            path: '/',
            dto: exampleDto,
            protected: true,
            controller: ExampleController.action,
            middlewares: [],
        },
    ],
};
```

Routes are mounted by `src/servers/expressServer.js`. DTOs are Zod schemas consumed by `dataValidation`. Protected routes use `Authenticator`. Controllers are wrapped by `globalControllerWrapper`, so controllers should generally return data or throw errors.

## Real-Time Interfaces
Socket.IO is initialized in `src/servers/websocketServer.js`. Current public event support is focused on wheelchair velocity:

```js
socket.emit('wheelchair:velocity', {
    linear: 0.5,
    angular: 0,
});

socket.on('wheelchair:velocity', data => {
    // { linear, angular, meta: { timestamp, source } }
});
```

ROS integration uses `src/lib/ros/connection.js`, which connects to `ws://ROSBRIDGE_HOST:ROSBRIDGE_PORT` and reconnects automatically.

## Project Structure
- `src/index.js`: server entry point
- `src/servers/`: Express, Socket.IO, module registry, and server composition
- `src/api/v1/`: feature modules
- `src/api/v1/<module>/routes.js`: HTTP route declarations
- `src/api/v1/<module>/*.controller.js`: HTTP handlers
- `src/api/v1/<module>/*.service.js`: business logic and module services
- `src/api/v1/<module>/dto/`: Zod validation schemas
- `src/api/v1/<module>/ros/`: ROS topics, services, and actions
- `src/db/`: TypeORM datasource, entities, and repositories
- `src/middleware/`: validation, auth, and global error middleware
- `src/utils/`: logger, timestamps, wrappers, and shared helpers
- `DEVELOPER_GUIDE/`: focused notes for contributors

## Adding a Module
1. Create `src/api/v1/<feature>/`.
2. Add `routes.js`, controller, DTOs, and service files as needed.
3. Add ROS files under `ros/` if the module talks to ROS.
4. Add `<feature>.module.js` that exports routers and services.
5. Register the module in `src/servers/registry.js`.
6. Add or update Swagger docs and tests where relevant.

## Notes
- Use `logger` from `src/utils/logger.js` instead of `console.log`.
- Keep route DTO names close to controller names.
- Prefer TypeORM repository methods already used in the codebase: `find`, `findOne`, `insert`, `save`, `update`, and `delete`.
- See `DEVELOPER_GUIDE/README.md` for contributor details.
