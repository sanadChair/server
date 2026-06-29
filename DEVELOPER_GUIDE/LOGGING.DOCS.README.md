
# Logging Guide

## Purpose
Keep logs consistent across server bootstrap, HTTP routes, Socket.IO callbacks, and ROS handlers.

---

## Logger

Use the shared logger from `src/utils/logger.js`.

```js
import logger from '#utils/logger.js';
```

Avoid `console.log` in application code.

---

## ROS Connection Logs

`src/lib/ros/connection.js` owns the rosbridge connection and emits reconnect events for ROS handlers.

```text
[ROS-CONNECTION] Connected to rosbridge at ws://localhost:9090
[ROS-CONNECTION] ROS error: <error message>
[ROS-CONNECTION] Connection to rosbridge closed
[ROS-CONNECTION] Failed to connect to rosbridge
[ROS-CONNECTION] Retrying in 2s
```

---

## Component Logs

Prefix logs with the component or module name:

```text
[SmartHome ROS TOPIC] Topic created: /SmartHome/DeviceEvents
[IRROSService] ROS reconnected, refreshing subscription...
[Telegram ROS service] Failed to get messages: <message>
[EXPRESS SERVER] initializing: GET /smart-home/devices
```

---

## Conventions

- Always prefix logs with `[Component]`.
- Use `info` for normal startup and successful operational events.
- Use `warn` for recoverable failures or rejected input.
- Use `error` for critical failures.
- Keep log messages concise and single-line.
- Include relevant IDs, route names, topic names, or service names.
- Avoid logging secrets, Telegram session strings, OTP codes, or auth tokens.
