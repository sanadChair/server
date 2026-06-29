# Socket.IO Guide

Socket.IO runs on the same HTTP server as Express. It is created in `src/servers/websocketServer.js` and receives callback groups from `CallbackRegistry`.

Authentication is not currently enforced at the Socket.IO layer.

## Callback Shape

Feature modules can expose Socket.IO callbacks with this shape:

```js
export const featureCallback = {
    publish: [
        {
            eventName: 'feature:event',
            callback: data => {},
        },
    ],
    subscribe: [
        {
            eventName: 'feature:event',
            callback: (socket, eventName, io) => {},
        },
    ],
    broadcast: [
        {
            eventName: 'feature:event',
            callback: (io, eventName) => {},
        },
    ],
    cleanup: socket => {},
};
```

- `publish`: client emits an event to the server.
- `subscribe`: runs when a socket connects and can attach per-socket listeners.
- `broadcast`: runs once with the `io` instance and can broadcast from internal events.
- `cleanup`: runs when a socket disconnects.

## Current Events

### `wheelchair:velocity`

Client publishes velocity:

```js
const socket = io('http://localhost:5051');

socket.emit('wheelchair:velocity', {
    linear: 0.4,
    angular: -0.2,
});
```

Both values must be numbers between `-1` and `1`.

Server broadcasts velocity updates on the same event:

```js
socket.on('wheelchair:velocity', data => {
    /*
    {
        linear: Number,
        angular: Number,
        meta: {
            timestamp: String,
            source: String
        }
    }
    */
});
```

Invalid velocity payloads are logged and ignored. There is currently no dedicated public error event for invalid wheelchair velocity payloads.

## Adding Events

1. Create or update a module callback object.
2. Add the callback object to the module's `WSCallback` array.
3. Add the module callback array to `CallbackRegistry` in `src/servers/registry.js`.
4. Keep event names scoped, for example `module:action`.
5. Validate incoming payloads before calling services or ROS handlers.
