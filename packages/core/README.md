# @socketdocs/core

The spec model and event registry at the heart of **SocketDocs** — Swagger-style documentation for Socket.IO. This package has **no dependency on Socket.IO or Express**: it defines the one canonical spec shape (`SocketDocsSpec`), how schemas are normalized, and how events are collected and turned into a spec.

You normally don't install this directly — `@socketdocs/express` and `@socketdocs/nestjs` depend on it — but it is useful for tooling that reads or transforms `/spec.json`.

## Install

```bash
npm install @socketdocs/core zod
```

## The spec model

```ts
import type {
  SocketDocsSpec,
  EventSpec,
  NamespaceSpec,
} from '@socketdocs/core';
```

A `SocketDocsSpec` looks like:

```jsonc
{
  "specVersion": "1.0",
  "info": {
    "title": "Chat API",
    "version": "1.0.0",
    "description": "Realtime chat",
  },
  "servers": [{ "url": "http://localhost:3000", "label": "Local" }],
  "socketPath": "/socket.io",
  "security": [{ "name": "token", "type": "apiKey", "in": "auth" }],
  "namespaces": {
    "/chat": {
      "name": "/chat",
      "description": "Room-based chat",
      "events": {
        "send_message": {
          "name": "send_message",
          "namespace": "/chat",
          "direction": "client_to_server", // client_to_server | server_to_client | bidirectional
          "kind": "request_response", // fire_and_forget | request_response (optional)
          "source": "declared", // sniffed | declared | decorator
          "summary": "Send a message to a room",
          "payloadSchema": {/* JSON Schema */},
          "responseSchema": {/* JSON Schema, ack payload */},
          "errors": [
            { "code": "INVALID_ROOM", "description": "Room does not exist" },
          ],
          "tags": ["chat"],
        },
      },
    },
  },
}
```

`EventSpec`, `NamespaceSpec`, `SecuritySpec`, `ErrorSpec`, `Direction`, `EventKind` and `EventSource` are all exported types.

## EventRegistry

`EventRegistry` holds events in memory and emits a change notification for every update.

```ts
import { EventRegistry } from '@socketdocs/core';

const registry = new EventRegistry({
  info: { title: 'Chat API', version: '1.0.0' },
  socketPath: '/socket.io',
});

registry.onChange(() => console.log('spec changed'));

// From sniffing: fills blanks only, never overwrites declared fields.
registry.observe('/chat', 'typing', { direction: 'client_to_server' });

// From declarations: wins over sniffed data, sets source: "declared".
registry.declare('/chat', 'send_message', {
  summary: 'Send a message to a room',
  payload: z.object({ text: z.string(), roomId: z.string() }),
});

registry.namespace('/chat', 'Room-based chat');
const spec: SocketDocsSpec = registry.toSpec();
```

Merge rules:

- Declared fields always win; sniffed data only fills blanks.
- `source` starts as `sniffed`, becomes `decorator` when discovered from framework metadata (`observe` with `{ source: "decorator" }`) and `declared` once declared. It is never downgraded.
- `observe()` swallows its own errors: sniffing must never break user code.

## normalizeSchema

Zod and JSON Schema inputs are converted **at registration time**:

```ts
import { normalizeSchema } from '@socketdocs/core';

normalizeSchema(z.object({ id: z.string() })); // -> JSON Schema
normalizeSchema({ type: 'object' }); // treated as JSON Schema already
normalizeSchema(undefined); // -> undefined
```

## lintSpec and toAsyncApi

```ts
import { lintSpec, toAsyncApi } from '@socketdocs/core';

const issues = lintSpec(spec); // [{ type: "error" | "warning", message, path }]
const asyncapi = toAsyncApi(spec); // AsyncAPI 3.0 document
```

`lintSpec` flags missing descriptions, undeclared/duplicated event names, duplicate error codes and similar problems; `toAsyncApi` maps namespaces/channels, security schemes and event errors to an AsyncAPI 3.0 document (using `spec.servers` for the server list).

## License

MIT © Nwankwo Samuel
