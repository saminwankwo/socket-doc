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

## Phase 7

- **`examples/express-chat` is plain JS (ESM), `examples/nest-chat` is TypeScript.** The Express test bed should be one command with no build step; Nest is decorator-based, so it compiles with `tsc` and `npm run start` runs build + `node dist/main.js`. Example default ports differ (3000 vs 3001) so both can run side by side.
- **`kind` added to the express `EventDeclaration`.** Ack-based events could previously only acquire `kind: "request_response"` after the first live ack; the registry already supported it, so the wrapper now forwards it. `kind: "request_response"` is set explicitly in the example's `join_room`.
- **Bugfix: `captureExamples` no longer marks sniffed events as `declared`.** Captured samples used `registry.declare()`, which flipped `source` to `declared` and showed a wrong "documented" badge in the UI. `EventRegistry.captureExample(ns, name, sample)` was added: it stores the first sanitized sample (first wins), never touches `source`, and ignores unknown events. The smoke test surfaced this.
- **Bugfix: `@socketdocs/nestjs` discovery no longer calls `app.get()` for optional providers.** Nest wraps every `app.*` call in an `ExceptionsZone` whose default teardown is `process.exit(1)`, so `app.get(DiscoveryService, { strict: false })` *killed the app* when the user had not imported `DiscoveryModule` (the express example's Nest cousin hit this on first run). Discovery now scans `ModulesContainer` (always registered) for the `DiscoveryService` instance and instantiates `MetadataScanner` directly. The Phase 6 tests missed it because they always imported `DiscoveryModule`.
- **Smoke check lives at the repo root**: `scripts/check-examples.mjs` (run via `npm run check:examples`) spawns express-chat with `PORT=0`, parses the ephemeral port from stdout, and asserts UI serving, declared events, undeclared-event sniffing, ack payloads, server→client discovery and wrong-token rejection (16 checks). Per the prompt only express-chat is covered; nest-chat was verified manually. `socket.io-client` is a root devDependency for the script, and CI runs the check after the build.
- **READMEs**: the `@socketdocs/core` and `@socketdocs/ui` READMEs documented the deleted contract-first API and were rewritten rather than just added. All package READMEs link back to the root guide and the examples.

## Phase 8

- **Built the optional CLI** (`packages/cli`, `@socketdocs/cli`, bin `socketdocs`): everything above was green, so there was no reason to skip it.
- **Zero dependencies beyond `@socketdocs/core`**: argument parsing is hand-rolled (`--url`, `--file`, `-o/--output`, `--help`, `--version`, with `--flag=value` support); the spec is fetched with global `fetch`, so `engines.node` is `>=18`. It never loads `.ts` contracts — only `--url` or `--file` JSON.
- **Exit codes**: `0` success, `1` failure (lint errors, fetch/IO problems, invalid JSON, non-spec documents), `2` usage errors. `lint` writes issues to stdout and the summary to stderr; `--help` goes to stdout, but the empty-args usage message goes to stderr.
- **`runCli()` never calls `process.exit`**: it resolves with the exit code (`bin.ts` sets `process.exitCode`), which keeps it embeddable and testable; `CliIO` is injectable for the same reason.
- **Minimal shape validation before use** (`info` and `namespaces` must be objects) so users get a clear "not a SocketDocs spec" instead of a stack trace from `lintSpec`/`toAsyncApi`. `--url` and `--file` are mutually exclusive.
- **Version is read from `package.json` at runtime** relative to `import.meta.url`, which resolves correctly both from `src` (tests) and `dist` (published).
- **Not wired into `check:examples`**: the CLI's vitest suite already includes a live-server `--url` test; the binary was additionally verified manually against the running express-chat example (`lint` and `export-asyncapi`).
