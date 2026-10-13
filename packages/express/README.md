# @socketdocs/express

Swagger-style, self-hosted documentation for Socket.IO Express apps. Mounts a docs UI and `spec.json` on your app and **auto-discovers events** from live traffic.

See the [repository README](../../README.md) for the full guide, or run [`examples/express-chat`](../../examples/express-chat) for a working demo.

## Install

```bash
npm install @socketdocs/express socket.io express zod
```

`express` and `socket.io` are peer dependencies (Socket.IO v4, Express 4 or 5). The React UI is bundled inside this package — there is nothing else to install or serve.

## Usage

```ts
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketDocs } from '@socketdocs/express';
import { z } from 'zod';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const docs = SocketDocs.setup(app, io, {
  path: '/socket-docs', // default
  title: 'Chat API',
  version: '1.0.0',
  description: 'Realtime chat',
  security: [{ name: 'token', type: 'apiKey', in: 'auth' }],
});

docs.event(
  'send_message',
  {
    summary: 'Send a message to a room',
    payload: z.object({ text: z.string(), roomId: z.string() }),
    response: z.object({ ok: z.boolean() }),
    errors: [{ code: 'INVALID_ROOM', description: 'Room does not exist' }],
  },
  { namespace: '/chat' },
);

server.listen(3000); // docs at http://localhost:3000/socket-docs
```

`docs.event(...)` **describes only** — it never registers handlers and never validates payloads.

## API

```ts
SocketDocs.setup(app: Express, io: SocketIOServer, options: SocketDocsOptions): SocketDocsInstance
```

| Option                            | Default          | Description                                                                                             |
| --------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------- |
| `path`                            | `"/socket-docs"` | Mount path for the UI and `spec.json`.                                                                  |
| `title`, `version`, `description` | —                | `info` block of the spec.                                                                               |
| `servers`                         | `[]`             | Server URLs offered in the UI's connection bar.                                                         |
| `security`                        | `[]`             | Security schemes for the Authorize modal (`in: "auth"` = handshake `auth` payload).                     |
| `socketPath`                      | `io.path()`      | Socket.IO engine path.                                                                                  |
| `auth`                            | —                | `{ username, password }` (HTTP Basic) or any Express `RequestHandler`, applied to the whole docs route. |
| `sniff`                           | `true`           | Enable auto-discovery.                                                                                  |
| `captureExamples`                 | `false`          | Store one sanitized sample payload per event from live traffic.                                         |

`SocketDocsInstance`:

- `event(name, def, { namespace = "/" })` — declare/enrich an event (chained).
- `namespace(name, description?)` — describe a namespace (chained).
- `spec()` — the current `SocketDocsSpec`.
- `registry` — the underlying `EventRegistry` from `@socketdocs/core`.

### Routes

| Route                  | Behaviour                                                                     |
| ---------------------- | ----------------------------------------------------------------------------- |
| `GET <path>`           | `301` redirect to `<path>/` (so relative asset and `spec.json` URLs resolve). |
| `GET <path>/spec.json` | Always-current spec (`registry.toSpec()`).                                    |
| `GET <path>/*`         | Bundled UI assets with SPA fallback to `index.html`.                          |

If `auth` is configured it protects every route above. `mountDocs(app, registry, { path, auth })` and `createDocsRouter(registry, { auth })` are exported for framework integrations (`@socketdocs/nestjs` uses them — there is exactly one implementation of routes, auth and static serving).

## Auto-discovery

`SocketDocs.setup()` instruments the Socket.IO server:

- records `socket.on(...)` registrations as `client_to_server` events, marking `kind: "request_response"` when a listener is invoked with a trailing ack callback;
- records events emitted to sockets (`socket.onAnyOutgoing`, Socket.IO ≥ 4.5) as `server_to_client`, merging into `bidirectional` when an event goes both ways;
- ignores reserved events (`connect`, `disconnect`, `error`, ...) and never throws into your code.

**Limitation:** events appear after the _first client connects_, because Socket.IO handlers are registered inside the `connection` callback. Opening the docs page and pressing **Connect** counts as that first connection.

## Publishing note

`ui-dist/` (the built UI) is generated by `npm run copy:ui` and included in the published package's `files`. If it is missing at runtime, the docs route serves a small HTML page explaining how to rebuild instead of crashing.

## License

MIT © Nwankwo Samuel
