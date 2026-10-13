# DECISIONS

Judgment calls made during the `1.0.0-alpha.0` redesign.

## Phase 1

- **Deleted `packages/cli`, `packages/server`, `packages/nestjs` in Phase 1.** They import old core APIs (`createContract`, `generateHtml`, `convertContractToSocketDocsSchema`) that Phase 2 removes. Rather than maintain shims, they are recreated fresh in Phases 4, 6, and 8. The old source is preserved in git history.
- **Deleted legacy root samples `contract.ts` and `socketdocs.json`.** Not referenced by any package; they belonged to the removed contract-first path.
- **vitest only.** Removed `jest`, `ts-jest`, `@types/jest`, and `jest.config.cjs` from core and root.
- **`examples/` workspace glob kept** with a `.gitkeep` placeholder; real examples arrive in Phase 7.

## Phase 4

- **Created `@socketdocs/express`**: Provides `SocketDocs.setup(app, io, options)` with auto-sniffing and UI/spec serving.
- **Auto-sniffing**: Hooks `socket.on` / `socket.once` defensively with wrap listener to detect acknowledgments (`kind: "request_response"`) when the final argument is a function. Outgoing events recorded via `socket.onAnyOutgoing` where available.
- **Bundled UI**: Built UI is copied into `packages/express/ui-dist` and included in `files` of `package.json`. At runtime it resolves relative to `dist/../ui-dist`.
- **Extracted `createDocsRouter`**: Exported from `@socketdocs/express` so Phase 6 (`@socketdocs/nestjs`) can mount the identical UI and `/spec.json` route without duplicating serving logic.

## Phase 5

- **Modularized UI (`@socketdocs/ui`)**: Split large monolithic `App.tsx` into modular components (`Sidebar`, `EventCard`, `TryItOut`, `AuthorizeModal`, `ConnectionBar`, `EventLog`, `SchemaView`) and a reusable `useSocketClient` hook.
- **Swagger-style Authorize**: Added top-bar Authorize button and modal supporting None, Bearer, API Key, and Custom handshake JSON with query parameters. Auth is safely persisted to `sessionStorage` and triggers reconnection.
- **Inline "Try it out" Execution**: Event cards feature an expandable Try-it-out area prefilled with `examples[0]` or generated from `sampleFromSchema()`. Executes with real ack responses and a 10s ack timeout notification.
- **Listen Toggle & Event Log**: Implemented real-time listen toggle for `server_to_client` and `bidirectional` events, with live color-coded event logging, auto-scroll, and event filter.

## Phase 6

- **NestJS event names**: recent NestJS versions store `true` in `MESSAGE_MAPPING_METADATA` and the actual event name in `MESSAGE_METADATA`; older versions store the pattern in `MESSAGE_MAPPING_METADATA`. The discovery code reads `MESSAGE_METADATA` first and falls back to a string/number/symbol `MESSAGE_MAPPING_METADATA`. If neither yields a name, the handler is skipped (no guessing).
- **Gateway options**: `@WebSocketGateway` stores options under `GATEWAY_OPTIONS` (with `GATEWAY_METADATA` being `true`); older versions stored the options object on `GATEWAY_METADATA`. Both are read, with `namespace` defaulting to `/`.
- **`@SocketEvent` → `source: "declared"`, bare `@SubscribeMessage` → `source: "decorator"`.** `EventRegistry.observe()` gained an optional `source` (defaults to `sniffed`) so discovery can record `decorator` without pretending the event was enriched. It never downgrades an already-declared event.
- **`kind` is left unset for Nest handlers.** Return-type/ack detection is unreliable without `emitDecoratorMetadata` (not emitted by all toolchains), and the prompt says not to guess. Declare it explicitly with `@SocketEvent({ kind: "request_response" })` when relevant.
- **One shared router implementation**: `mountDocs(app, registry, { path, auth })` now lives in `@socketdocs/express` (next to `createDocsRouter`) and is used by both `SocketDocs.setup` and `SocketDocsModule.setup`, so redirect, `spec.json`, static serving and auth have exactly one implementation.
- **Redirect fix**: Express treats `/path` and `/path/` as the same route, so the bare `<path>` route now calls `next()` when the request already has the trailing slash (previously `<path>/` redirected to itself forever). The SPA fallback is a `router.use(...)` middleware instead of `router.get("*")`, which is invalid on Express 5 (`@nestjs/platform-express` ships Express 5).
- **Nest sniffing**: gateways receive their Socket.IO server during `app.init()`. `SocketDocsModule.setup()` instruments it immediately if it is already reachable, otherwise it wraps `app.init()` and instruments right after initialization. The server is found through `@WebSocketServer()` properties (Nest does not expose its sockets container publicly), so **a gateway that does not expose its server/namespace with `@WebSocketServer()` only gets metadata-based discovery** — `server_to_client` events must then be declared. Namespaces are hooked with `prependListener` so sniffing runs before Nest's own connection handler.
- **Express adapter required**: the module throws a clear error unless the HTTP adapter instance is an Express app (checked via `use` + `handle`); Fastify is not supported.
- **Versions**: `@nestjs/*` dev/peer ranges include v10–v12 (the repo tests against v12); `@nestjs/testing`, `@nestjs/platform-express`, `@nestjs/platform-socket.io`, `socket.io`, `socket.io-client` and `zod` are devDependencies of `@socketdocs/nestjs`; `express` and `socket.io` are peers. The root `package.json` no longer carries NestJS devDependencies.
