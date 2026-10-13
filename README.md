# SocketDocs

**Swagger for Socket.IO.** SocketDocs turns a running Socket.IO server into interactive, Swagger-style documentation: it discovers the events your server handles, lets you enrich them with [Zod](https://zod.dev) or JSON Schema, and serves a self-hosted UI with a **Try it out** playground, an **Authorize** button for handshake auth, and a live event log — all mounted on your own Express (or NestJS) app, no separate docs site required.

- **Zero config**: mount `SocketDocs.setup(app, io, ...)` and every event appears automatically as clients use them.
- **Enrich where it counts**: add schemas, examples, errors and docs to the events that matter with `docs.event(...)` (or `@SocketEvent` in NestJS).
- **One spec model**: `/spec.json` is the single `SocketDocsSpec` shape consumed by the UI — export it, diff it, or point tooling at it.

> Status: `1.0.0-alpha.0`. Socket.IO v4 only, see [Limitations](#limitations).

---

## Table of contents

- [Express quickstart (60 seconds)](#express-quickstart-60-seconds)
- [NestJS quickstart](#nestjs-quickstart)
- [How auto-discovery works](#how-auto-discovery-works)
- [Declaring events](#declaring-events)
- [Auth](#auth)
- [The UI](#the-ui)
- [Packages](#packages)
- [Examples](#examples)
- [Limitations](#limitations)
- [Screenshots](#screenshots)
- [Development](#development)

---

## Express quickstart (60 seconds)

```bash
npm install @socketdocs/express socket.io express zod
```

```ts
import express from "express";
import http from "http";
import { Server } from "socket.io";
import { SocketDocs } from "@socketdocs/express";
import { z } from "zod";

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const docs = SocketDocs.setup(app, io, {
  path: "/socket-docs",
  title: "Chat API",
  version: "1.0.0",
  description: "Realtime chat",
});

// Optional enrichment. Without this, events are still discovered automatically (names only).
docs.event("send_message", {
  summary: "Send a message to a room",
  payload: z.object({ text: z.string(), roomId: z.string() }),
  response: z.object({ ok: z.boolean() }),
  errors: [{ code: "INVALID_ROOM", description: "Room does not exist" }],
});

server.listen(3000);
```

Open <http://localhost:3000/socket-docs> and you get every event your server handles,
listed automatically, with a **Try it out** flow per event.

### `SocketDocs.setup()` options

| Option | Default | Description |
|---|---|---|
| `path` | `"/socket-docs"` | Where the docs UI and `spec.json` are mounted. |
| `title`, `version`, `description` | — | `info` block of the spec. |
| `servers` | `[]` | Extra server URLs offered in the UI's connection bar. |
| `security` | `[]` | Security schemes shown/prefilled in the **Authorize** modal (`in: "auth"` means the Socket.IO handshake `auth` payload). |
| `socketPath` | `io.path()` | Socket.IO engine path (not the namespace). |
| `auth` | — | Protects the docs page itself: `{ username, password }` (HTTP Basic) or any Express middleware. |
| `sniff` | `true` | Auto-discover events from live traffic. |
| `captureExamples` | `false` | Store one sanitized sample payload per event from live traffic. |

`docs.event(name, def, { namespace })` returns the instance, so calls can be chained.
The instance also exposes `registry` (the `EventRegistry`), `namespace(name, description)` and `spec()`.

## NestJS quickstart

```bash
npm install @socketdocs/nestjs @nestjs/core @nestjs/websockets @nestjs/platform-socket.io socket.io
```

```ts
import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { SocketDocsModule, SocketEvent } from "@socketdocs/nestjs";
import { AppModule } from "./app.module.js";

const app = await NestFactory.create(AppModule);
app.useWebSocketAdapter(new IoAdapter(app)); // SocketDocs sniffs the Socket.IO server

SocketDocsModule.setup("/socket-docs", app, {
  title: "Chat API",
  version: "1.0.0",
});

await app.listen(3000);
```

```ts
import { SubscribeMessage } from "@nestjs/websockets";
import { SocketEvent } from "@socketdocs/nestjs";
import { z } from "zod";

@SubscribeMessage("send_message")
@SocketEvent({
  summary: "Send a message to a room",
  payload: z.object({ text: z.string(), roomId: z.string() }),
  response: z.object({ ok: z.boolean() }),
  errors: [{ code: "INVALID_ROOM", description: "Room does not exist" }],
})
handleMessage(@MessageBody() data: unknown) {
  return { ok: true };
}
```

`SocketDocsModule.setup(path, app, config)` mirrors `SwaggerModule.setup(...)`: it reads your existing
`@WebSocketGateway` / `@SubscribeMessage` metadata, mounts the same UI and `spec.json` router as the
Express package, and returns a docs instance (`event()`, `namespace()`, `spec()`, `registry`).

## How auto-discovery works

SocketDocs hooks your Socket.IO server and records events as they happen:

- **Incoming** (`client_to_server`): every `socket.on(...)` registration is recorded, and when the
  listener is invoked with a function as its last argument the event is marked
  `kind: "request_response"` (an ack was used).
- **Outgoing** (`server_to_client`): events emitted to connected sockets are recorded through
  `socket.onAnyOutgoing(...)` (Socket.IO ≥ 4.5). An event that is both received and emitted becomes
  `bidirectional`.
- Reserved Socket.IO events (`connect`, `disconnect`, `error`, ...) are excluded.
- Sniffing never throws into your code and never changes handler behaviour.

**The one limitation, per framework:**

| Framework | When events appear | Why |
|---|---|---|
| Express | After the **first client connects** | Socket.IO handlers are registered inside the `connection` callback. Opening the docs page and pressing **Connect** counts as that first client. |
| NestJS | At **startup**, before any client connects | Events are read from gateway metadata. `server_to_client` events are then sniffed once the gateway emits them (requires `@WebSocketServer()` — see [Limitations](#limitations)). |

Each event in the UI carries a `source` badge: **documented** (`declared`, enriched by you) vs
**auto-discovered** (`sniffed` or `decorator`, name-only) — a quick way to see what still needs schemas.

## Declaring events

Declaration **describes only**: it never registers handlers and never validates or blocks payloads.

```ts
docs.event("send_message", {
  summary: "Send a message to a room",
  description: "Broadcast to everyone in the room.",
  payload: z.object({ text: z.string(), roomId: z.string() }),   // Zod ...
  response: z.object({ ok: z.boolean() }),                        // ack payload
  errors: [{ code: "INVALID_ROOM", description: "Room does not exist" }],
  tags: ["chat"],
  kind: "request_response",                                      // client passes an ack callback
  authRequired: true,
}, { namespace: "/chat" });
```

- **Zod** schemas (v3/v4) and plain **JSON Schema** objects are both accepted; conversion happens at
  registration time (`normalizeSchema` in `@socketdocs/core`).
- Declared fields always win; sniffed data only fills blanks (e.g. a `kind` discovered from live acks).
- NestJS: the same fields are available on `@SocketEvent({...})`, placed alongside `@SubscribeMessage`.

## Auth

Two independent things:

1. **Protecting the docs page.** Pass `auth` to `setup()` — either `{ username, password }` (HTTP Basic
   over the whole `/socket-docs` route, including `spec.json`) or any Express `RequestHandler`
   (e.g. your session/JWT middleware).
2. **Authorizing the playground connection.** The UI's **Authorize** button sets what is sent in the
   Socket.IO handshake `auth` payload (and optional query params): **None**, **Bearer token**
   (`auth: { token }`), **API key** (`auth: { apiKey }`) or **Custom** (free-form JSON merged into
   `auth`). `spec.security` entries prefill the field names, and the value is kept in `sessionStorage`
   so a page reload keeps you signed in. After changing it, the client reconnects.

On the server, check it as usual:

```ts
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token !== process.env.TOKEN) return next(new Error("unauthorized"));
  next();
});
```

> Browsers cannot set custom WebSocket headers, so SocketDocs auth travels through the handshake
> `auth` payload or query params — never the `Authorization` header.

## The UI

- **Sidebar**: namespaces and events, with search across name, summary and tags.
- **Event cards**: summary, payload/response schemas, examples, errors, and an inline **Try it out**
  with a JSON editor prefilled from `examples[0]` or generated from the payload schema. **Execute**
  emits the event; for ack-based events the ack response is shown in the card (10 s timeout message).
- **Connection bar**: server URL (defaults to `window.location.origin`), namespace picker, connect /
  disconnect and a status indicator. One socket per namespace, created lazily and reused.
- **Listen toggle** on `server_to_client` / `bidirectional` events to receive and log pushes.
- **Event log**: timestamped in/out/error/info entries with payload, clear, auto-scroll and a filter.
- Dark/light theme toggle.

## Packages

| Package | Path | Role |
|---|---|---|
| [`@socketdocs/core`](packages/core) | `packages/core` | `SocketDocsSpec` model, `EventRegistry`, `normalizeSchema`, `lintSpec`, `toAsyncApi`. No Socket.IO/Express imports. |
| [`@socketdocs/express`](packages/express) | `packages/express` | `SocketDocs.setup(...)`, Socket.IO instrumentation, `spec.json` + bundled UI serving. |
| [`@socketdocs/nestjs`](packages/nestjs) | `packages/nestjs` | `SocketDocsModule.setup(...)`, gateway discovery, `@SocketEvent`. |
| `@socketdocs/ui` | `packages/ui` | The React SPA (private; its build is bundled into `@socketdocs/express`). |

## Examples

- [`examples/express-chat`](examples/express-chat) — Express + Socket.IO chat: a declared event, an
  undeclared event (to show sniffing), an ack-based event and handshake-token auth. **The manual test bed.**
- [`examples/nest-chat`](examples/nest-chat) — minimal NestJS gateway with two `@SubscribeMessage`
  handlers, one using `@SocketEvent`.

```bash
npm install && npm run build            # build the packages + UI bundle
npm run start -w socketdocs-example-express-chat
npm run start -w socketdocs-example-nest-chat
npm run check:examples                  # end-to-end smoke check of express-chat
```

## Limitations

- **Socket.IO v4 only.** Raw `ws`, Fastify websockets and Socket.IO v2 are not supported.
- **Express sniffing is timing-dependent**: events appear after the first client connection (the docs
  page itself can be that client). NestJS discovery has no such gap for client → server events.
- **NestJS `server_to_client` sniffing** requires the gateway to expose its Socket.IO server/namespace
  via `@WebSocketServer()`. Without it, declare those events with
  `@SocketEvent({ direction: "server_to_client" })` or `docs.event(...)`.
- **Header auth does not apply to sockets**: the Socket.IO handshake cannot carry custom headers from
  a browser, so use the `auth` payload or query params (see [Auth](#auth)).
- **Express adapter required for NestJS**: `SocketDocsModule.setup()` throws on Fastify adapters.
- **Declaration is documentation only**: SocketDocs does not validate or transform your payloads.
- Sniffed examples are truncated and obvious secret keys (`password`, `token`, `authorization`,
  `secret`) are redacted, but avoid capturing sensitive payloads in production.

## Screenshots

<!-- Replace these placeholders with real screenshots before the 1.0 release. -->

| Overview | Try it out | Authorize |
|---|---|---|
| ![Overview](docs/screenshots/overview.png) | ![Try it out](docs/screenshots/try-it-out.png) | ![Authorize](docs/screenshots/authorize.png) |

## Development

```bash
npm install
npm run build        # UI bundle → packages/ui/dist → packages/express/ui-dist, then tsc -b
npm test             # vitest across all workspaces
npm run lint
npm run check:examples
```

Design decisions made during the `1.0.0-alpha.0` redesign are recorded in [DECISIONS.md](DECISIONS.md);
the full changelog is in [CHANGELOG.md](CHANGELOG.md).

## License

MIT © Nwankwo Samuel
