# SocketDocs

**Swagger-style documentation and a live playground for Socket.IO APIs.**

Mount one line on your Express server and get an interactive docs page at `/socket-docs`: every event listed, schemas and examples shown, and a **Try it out** button that connects to your real server and emits events.

```ts
SocketDocs.setup(app, io, { title: 'Chat API', version: '1.0.0' });
```

> **Status:** Express is supported. NestJS support is in progress (see [Roadmap](#roadmap)).

---

## Why SocketDocs?

REST has Swagger. WebSockets have had nothing comparable. Socket.IO handlers are registered at runtime inside a `connection` callback, so there is no route table to read. SocketDocs fills that gap in two ways:

1. **Auto-discovery:** it watches `socket.on(...)` calls and lists every event it sees, with zero configuration.
2. **Code-first descriptions:** you describe an event next to its handler (`docs.event(...)`) to add summaries, schemas, examples and errors. Docs and code live in the same place, so they cannot drift apart.

You can start with the first and add the second one event at a time, the same way you grow a Swagger doc.

---

## Installation

```bash
npm install @socketdocs/express
```

`zod` is optional. Install it only if you want to describe payloads with Zod schemas. Plain JSON Schema works without it.

**Requirements:** Node.js 18+, Express 4 or 5, Socket.IO 4.

---

## Quick start (Express)

```ts
import express from 'express';
import http from 'node:http';
import { Server } from 'socket.io';
import { SocketDocs } from '@socketdocs/express';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// 1. Mount the docs
const docs = SocketDocs.setup(app, io, {
  title: 'Chat API',
  version: '1.0.0',
  description: 'Realtime chat API',
});

// 2. Your normal Socket.IO code, unchanged
io.on('connection', (socket) => {
  socket.on('send_message', (payload, ack) => {
    ack?.({ ok: true });
  });
});

server.listen(3000, () =>
  console.log('Docs: http://localhost:3000/socket-docs'),
);
```

Open `http://localhost:3000/socket-docs`. Once a client connects, `send_message` appears in the list automatically.

---

## Describing events

Auto-discovery only knows an event's **name**. To add detail, declare it:

```ts
import { z } from 'zod';

docs.event('send_message', {
  summary: 'Send a message to a room',
  description: 'Broadcasts the message to everyone in the room.',
  tags: ['messaging'],
  payload: z.object({
    text: z.string().min(1).max(500),
    roomId: z.string(),
  }),
  response: z.object({ ok: z.boolean() }), // the ack
  errors: [{ code: 'INVALID_ROOM', description: 'Room does not exist' }],
  examples: [{ text: 'Hello!', roomId: 'general' }],
});
```

`payload` and `response` accept either a **Zod schema** or a **raw JSON Schema** object.

### Server-to-client events

Document events your server emits so clients know what to listen for:

```ts
docs.event('new_message', {
  direction: 'server_to_client',
  summary: 'A new message arrived in a room',
  payload: z.object({ id: z.string(), text: z.string(), sender: z.string() }),
});
```

### Namespaces

```ts
docs.namespace('/chat').event('join_room', {
  summary: 'Join a chat room',
  payload: z.object({ roomId: z.string() }),
});
```

Events without a namespace belong to the default namespace `/`.

### Event options

| Option         | Type                                                          | Description                                         |
| -------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| `direction`    | `'client_to_server' \| 'server_to_client' \| 'bidirectional'` | Defaults to `client_to_server`                      |
| `summary`      | `string`                                                      | One-line description shown on the card              |
| `description`  | `string`                                                      | Longer explanation                                  |
| `tags`         | `string[]`                                                    | Used for search and grouping                        |
| `payload`      | Zod or JSON Schema                                            | Shape of the data sent with the event               |
| `response`     | Zod or JSON Schema                                            | Shape of the acknowledgement                        |
| `errors`       | `{ code, description }[]`                                     | Possible error responses                            |
| `examples`     | `unknown[]`                                                   | Example payloads; the first one prefills Try it out |
| `authRequired` | `boolean`                                                     | Shows an AUTH badge                                 |
| `deprecated`   | `boolean`                                                     | Shows the event struck through                      |

---

## Configuration

```ts
SocketDocs.setup(app, io, {
  path: '/socket-docs', // where the docs are mounted
  title: 'Chat API',
  version: '1.0.0',
  description: '...',
  socketPath: '/socket.io', // your Socket.IO "path" option
  security: [{ name: 'token', type: 'bearer', in: 'auth' }],
  auth: { username: 'admin', password: 'secret' }, // or an Express middleware
  enabled: process.env.NODE_ENV !== 'production',
});
```

| Option                              | Default        | Description                                                       |
| ----------------------------------- | -------------- | ----------------------------------------------------------------- |
| `path`                              | `/socket-docs` | Mount path for the docs UI                                        |
| `title` / `version` / `description` |                | Shown in the page header                                          |
| `socketPath`                        | `/socket.io`   | The path your Socket.IO server listens on                         |
| `security`                          | `[]`           | Credentials the **Authorize** dialog should offer                 |
| `auth`                              | none           | Protects the docs page itself (HTTP Basic or your own middleware) |
| `enabled`                           | `true`         | Set `false` to mount nothing                                      |

The raw spec is available at `/<path>/spec.json` if you want to inspect it or build on it.

---

## The playground

Every event card has a **Try it out** button.

- **Connection bar:** the server URL is inferred from the page address, so there is nothing to configure. Pick a namespace and click **Connect**.
- **Authorize:** supply a Bearer token, API key or custom query parameter. Values are sent in the Socket.IO handshake `auth` payload (or query string).
- **Try it out:** edit the payload (prefilled from your first example), click **Execute**, and see the acknowledgement and timing.
- **Listen:** subscribe to server-to-client events and watch them arrive.
- **Live event log:** every sent and received event, filterable, with timestamps.
- Light and dark themes.

> Browsers cannot set custom HTTP headers on WebSocket connections, so credentials travel in Socket.IO's `auth` object or query string, not in headers. Read them on the server with `socket.handshake.auth` or `socket.handshake.query`.

---

## How discovery works (and its limits)

SocketDocs wraps `socket.on` and records each event name as your handlers register. Because Socket.IO registers handlers when a client connects:

- Discovered events appear **after the first client connects**.
- Discovered events have a **name only**. Add `docs.event(...)` for schemas, descriptions and examples.
- A declared event always overrides its discovered version.
- Socket.IO's reserved events (`connect`, `disconnect`, `connect_error`, and so on) are never listed.
- Events your server **emits** cannot be discovered. Declare them with `direction: 'server_to_client'`.

Declared events appear immediately, even before anyone connects.

---

## NestJS (in progress)

The planned API mirrors `SwaggerModule`:

```ts
SocketDocsModule.setup('/socket-docs', app, {
  title: 'Chat API',
  version: '1.0.0',
});
```

It will read your existing `@WebSocketGateway` and `@SubscribeMessage` handlers with no changes, with an optional `@SocketEvent({...})` decorator for extra detail.

---

## Security

The docs page lists your API's events and lets visitors send real messages to your server. **Do not expose it publicly by accident.**

- Disable it in production: `enabled: process.env.NODE_ENV !== 'production'`.
- Or protect it: `auth: { username, password }`, or pass your own middleware.
- Never put real secrets in `examples`. They are served to anyone who can open the page.

---

## Command line

```bash
# Download the spec from a running server
npx socketdocs export --url http://localhost:3000/socket-docs -o spec.json

# Lint the spec
npx socketdocs lint spec.json

# Export as AsyncAPI 3.0
npx socketdocs asyncapi spec.json -o asyncapi.json
```

---

## Packages

| Package               | Purpose                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| `@socketdocs/core`    | Spec model, schema normalization (Zod / JSON Schema), event registry, linting, AsyncAPI export |
| `@socketdocs/express` | Express mount, Socket.IO discovery, bundled docs UI                                            |
| `@socketdocs/nestjs`  | NestJS module and decorators _(in progress)_                                                   |
| `@socketdocs/cli`     | Spec export, lint and AsyncAPI commands                                                        |

---

## Local development

```bash
git clone https://github.com/saminwankwo/socket-doc.git
cd socketdocs
npm install
npm run build
npm test
```

Try your local build in another project without publishing to npm:

```bash
# in socketdocs
mkdir -p /tmp/sd && npm pack -w packages/core -w packages/express --pack-destination /tmp/sd

# in your project
npm install /tmp/sd/socketdocs-core-*.tgz /tmp/sd/socketdocs-express-*.tgz
```

Prefer tarballs (or [`yalc`](https://github.com/wclr/yalc)) over `npm link`. A symlinked package can resolve its own copy of `socket.io`, and discovery then patches the wrong one. Run `npm ls socket.io` in your project and confirm there is exactly one copy.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for the package layout and how to run the pack test.

## License

MIT © [Nwankwo Samuel](https://github.com/saminwankwo)
