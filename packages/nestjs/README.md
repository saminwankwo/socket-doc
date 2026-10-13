# @socketdocs/nestjs

Swagger-style, self-hosted documentation for NestJS WebSocket (Socket.IO) apps. Reads your existing `@WebSocketGateway` / `@SubscribeMessage` metadata at startup and mounts the SocketDocs UI plus `spec.json` — mirroring `SwaggerModule.setup(...)`.

See the [repository README](../../README.md) for the full guide, or run [`examples/nest-chat`](../../examples/nest-chat) for a working demo.

## Install

```bash
npm install @socketdocs/nestjs @nestjs/core @nestjs/websockets @nestjs/platform-socket.io socket.io zod
```

Peers: `@nestjs/common`, `@nestjs/core`, `@nestjs/websockets` (v10–v12), `reflect-metadata`, `express`, `socket.io` (v4). Socket.IO is used when you set `app.useWebSocketAdapter(new IoAdapter(app))`.

## Usage

```ts
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SocketDocsModule } from '@socketdocs/nestjs';
import { AppModule } from './app.module.js';

const app = await NestFactory.create(AppModule);
app.useWebSocketAdapter(new IoAdapter(app)); // lets SocketDocs sniff server -> client events

SocketDocsModule.setup('/socket-docs', app, {
  title: 'Chat API',
  version: '1.0.0',
  description: 'Realtime chat',
  security: [{ name: 'token', type: 'apiKey', in: 'auth' }],
  // auth: { username: "admin", password: "secret" },  // protects the docs page
});

await app.listen(3000); // docs at http://localhost:3000/socket-docs
```

Because discovery reads decorator metadata, **client → server events appear before any client connects** (unlike the Express sniffing path).

## `SocketDocsModule.setup(path, app, config)`

`config` mirrors the Express options: `title`, `version`, `description`, `servers`, `security`, `socketPath`, `auth` (Basic credentials or an Express middleware) and `sniff`. The returned instance supports:

- `event(name, def, { namespace })` — declare/enrich an event imperatively.
- `namespace(name, description?)`, `spec()`, `registry`.

The Express HTTP adapter is required (`NestExpressApplication`); Fastify throws a clear error. The shared router/UI implementation lives in `@socketdocs/express`, so routes, auth and static serving behave exactly like the Express package.

## Enriching handlers with `@SocketEvent`

```ts
import { MessageBody, SubscribeMessage } from "@nestjs/websockets";
import { SocketEvent } from "@socketdocs/nestjs";
import { z } from "zod";

@SubscribeMessage("send_message")
@SocketEvent({
  summary: "Send a message to a room",
  description: "Broadcasts the message to everyone in the room.",
  payload: z.object({ text: z.string(), roomId: z.string() }),   // Zod or JSON Schema
  response: z.object({ ok: z.boolean() }),
  errors: [{ code: "INVALID_ROOM", description: "Room does not exist" }],
  tags: ["chat"],
  kind: "request_response",
  authRequired: true,
})
handleMessage(@MessageBody() data: unknown) {
  return { ok: true };
}
```

- Handlers without `@SocketEvent` are still discovered (name + `client_to_server` direction) and marked `source: "decorator"`; handlers with it are marked `source: "declared"`.
- `kind` is **never guessed** — set it explicitly when the handler acknowledges the client.
- The namespace comes from the gateway options (`@WebSocketGateway({ namespace: "/chat" })`), defaulting to `/`.

## Server → client events

Sniffing server → client events needs access to the gateway's Socket.IO server, which Nest exposes through `@WebSocketServer()`:

```ts
@WebSocketServer()
server!: Server;

handleConnection(client: Socket) {
  client.emit("welcome", { ok: true }); // shows up as server_to_client in the docs
}
```

Without it, only decorator-discovered client → server events are automatic; declare pushes yourself:

```ts
@SocketEvent({ direction: "server_to_client", summary: "Welcome message" })
```

## License

MIT © Nwankwo Samuel
