# SocketDocs Redesign "Swagger for Sockets" - Product Requirements Document

## Overview
- **Summary**: Refactor the `socketdocs` monorepo from a contract-first multi-framework toolkit into a **code-first, Swagger-style documentation tool for Socket.IO**. A developer mounts `SocketDocs.setup(app, io, opts)` on an existing Express + Socket.IO server and automatically gets a documentation UI that auto-discovers events, plus optional declarative enrichment. NestJS gets the same via `SocketDocsModule.setup(...)`.
- **Purpose**: Eliminate the three diverging schema models, ship the React UI inside the published package, fix the broken playground connection logic, and add runtime event auto-discovery (sniffing) so zero-config usage works.
- **Target Users**: Developers with existing Express + Socket.IO (or NestJS gateway) servers who want Swagger-style interactive docs without writing a contract first.

## Goals
- One canonical spec model (`SocketDocsSpec`) used everywhere: core, server, UI, CLI.
- `GET /<path>/spec.json` returns exactly the shape the React UI consumes.
- The React UI is built and bundled into `@socketdocs/express` so published users get the full SPA (not a fallback).
- Socket.IO events are auto-discovered at runtime (sniffing); declared enrichment overrides sniffed fields.
- Playground connects correctly: namespace in the URL, engine `path` separate, default URL from `window.location.origin`.
- NestJS gateway events discovered at startup (before any client connects).
- Existing UI look/feel, layout, theme toggle, event cards, and Try-it flow preserved.

## Non-Goals
- Raw `ws`, Fastify, and the old validating Socket.IO adapter are removed (no backwards-compat).
- SDK generators, mock server, and plugin system are removed.
- The legacy fluent `createContract`, `SocketDocsSchema`/`socketdocs.json`, and `generateHtml()` as a full UI are removed.
- No header-based WebSocket auth (browsers can't set custom WS headers); auth goes through Socket.IO handshake `auth` or query params.
- Socket.IO v4 only (no v2/v3 support).

## Background & Context
The architecture report (`SOCKETDOCS_ARCHITECTURE_REPORT.md`) identified 11 concrete problems. Key ones: three schema shapes, `/schema.json` wrong shape, UI never shipped, playground namespace/path bug, no auto-discovery, stale compiled files in `src/`, false CHANGELOG claims, dual test configs, dead code.

## Functional Requirements
- **FR-1**: `@socketdocs/express` exposes `SocketDocs.setup(app, io, opts)` returning an instance with `event(name, def, opts?)`, `namespace(name, description?)`, `registry`, and `spec()`.
- **FR-2**: `docs.event(...)` describes only; it must not register handlers or validate payloads.
- **FR-3**: Routes under `opts.path` (default `/socket-docs`): redirect no-trailing-slash → with slash, `GET /spec.json` returns current spec, static UI assets with SPA fallback, optional auth protecting all routes.
- **FR-4**: Auto-sniffing records client→server events (and ack usage → `request_response`) and server→client events via `socket.onAnyOutgoing` where available; reserved events excluded.
- **FR-5**: Sniffed data never overwrites declared fields; declared fields win; `source` becomes `declared`.
- **FR-6**: The UI fetches `./spec.json`, renders events, shows `source` badge, supports inline Try-it-out with ack handling and 10s timeout, Authorize modal (None/Bearer/API key/Custom JSON + query), connection bar with namespace picker, Listen toggle for server→client events, color-coded live event log with filter.
- **FR-7**: `@socketdocs/nestjs` `SocketDocsModule.setup(path, app, config)` discovers `@WebSocketGateway`/`@SubscribeMessage` events at startup, merges optional `@SocketEvent` enrichment, and serves the same router/UI as Express.
- **FR-8**: `normalizeSchema` converts Zod → JSON Schema at registration time; raw JSON Schema passes through; `undefined` returns `undefined`.
- **FR-9**: `lintSpec(spec)` and `toAsyncApi(spec)` operate on `SocketDocsSpec` (ported, with errors mapped and real servers used).
- **FR-10**: `npm pack` of `@socketdocs/express` contains the built UI (`ui-dist/index.html`).

## Non-Functional Requirements
- **NFR-1**: `npm install && npm run build && npm test` pass from a clean clone after every phase.
- **NFR-2**: No stale compiled `*.js`/`*.d.ts` files inside any `src/`.
- **NFR-3**: Only vitest as the test runner; no jest config.
- **NFR-4**: Sniffing must never throw into user code (all observers wrapped in try/catch).
- **NFR-5**: Core package must not import Socket.IO or Express.

## Constraints
- **Technical**: TypeScript project references, ESM (`"type": "module"`), Zod 4, Socket.IO v4, Express 4/5, NestJS 11, React 18, Vite 5.
- **Business**: Version becomes `1.0.0-alpha.0`; breaking changes allowed; no backwards-compat shims.
- **Dependencies**: `zod-to-json-schema`, `ajv` (core), `socket.io-client` (ui), `@faker-js/faker` removed.

## Assumptions
- Socket.IO ≥ 4.5 for `onAnyOutgoing`; older versions degrade gracefully (only client→server sniffing).
- NestJS gateway metadata keys (`GATEWAY_METADATA`, `MESSAGE_MAPPING_METADATA`) are stable in `@nestjs/websockets/constants`.
- The existing React UI's visuals are acceptable; only data pipeline and connection logic change.

## Acceptance Criteria

### AC-1: Single spec model
- **Type**: `rule`
- **Given**: the repository after redesign
- **When**: searching for `SocketDocsSchema`, `createContract`, `generateSpec`
- **Then**: none exist as public APIs; only `SocketDocsSpec` and `EventRegistry` are exported from core
- **Pass Condition**: `grep` finds no public exports of removed symbols; core `index.ts` exports only spec types, `EventRegistry`, `normalizeSchema`, `lintSpec`, `toAsyncApi`
- **Evidence**: core build output + grep of dist

### AC-2: spec.json matches UI consumption
- **Type**: `rule`
- **Given**: an Express app with `SocketDocs.setup`
- **When**: `GET /socket-docs/spec.json`
- **Then**: response has `specVersion`, `info`, `namespaces.*.events.*` with `payloadSchema`/`responseSchema`/`source`
- **Pass Condition**: response parses as `SocketDocsSpec` and the React UI renders events without `spec.namespaces` being undefined
- **Evidence**: integration test + manual UI render

### AC-3: UI bundled into express package
- **Type**: `rule`
- **Given**: `npm pack` run in `packages/express`
- **When**: inspecting the tarball
- **Then**: it contains `ui-dist/index.html` and the UI assets
- **Pass Condition**: tarball listing includes `ui-dist/index.html`
- **Evidence**: `npm pack --dry-run` or extracted tarball listing

### AC-4: Auto-sniffing of client→server events
- **Type**: `rule`
- **Given**: a server with `socket.on("ping", (data, ack) => ack(...))` and no declared event
- **When**: a client emits `ping`
- **Then**: `spec.json` shows `ping` with `direction: "client_to_server"`, `kind: "request_response"`, `source: "sniffed"`
- **Pass Condition**: spec contains the event with correct fields
- **Evidence**: vitest integration test with real socket.io server + client

### AC-5: Declared enrichment overrides sniffed
- **Type**: `rule`
- **Given**: `docs.event("ping", { summary: "...", payload: z.object(...) })` plus sniffing
- **When**: spec is generated
- **Then**: `summary` and `payloadSchema` come from declaration; `source` is `declared`; sniffed `kind` preserved if not declared
- **Pass Condition**: declared fields present, `source === "declared"`
- **Evidence**: unit test of EventRegistry merge + integration test

### AC-6: Playground namespace in URL, engine path separate
- **Type**: `rule`
- **Given**: the playground connecting to namespace `/chat`
- **When**: creating the socket
- **Then**: `io(origin + "/chat", { path: spec.socketPath ?? "/socket.io" })`
- **Pass Condition**: socket connects to the right namespace; engine path not set to the namespace
- **Evidence**: component test with mocked socket.io-client verifying constructor args

### AC-7: Default server URL from window.location
- **Type**: `rule`
- **Given**: docs served from `http://localhost:3000/socket-docs/`
- **When**: the playground loads
- **Then**: server URL input defaults to `http://localhost:3000`
- **Pass Condition**: initial state equals `window.location.origin`
- **Evidence**: component test

### AC-8: NestJS events before any client connects
- **Type**: `rule`
- **Given**: a NestJS app with a `@WebSocketGateway` and `@SubscribeMessage("ping")`
- **When**: `SocketDocsModule.setup` runs at startup
- **Then**: `spec.json` contains `ping` before any client connects
- **Pass Condition**: spec has the event immediately after setup
- **Evidence**: `@nestjs/testing` integration test

### AC-9: No stale compiled files in src
- **Type**: `rule`
- **Given**: the repo tree
- **When**: listing `packages/*/src/`
- **Then**: no `*.js` or `*.d.ts` files (except type-only `.d.ts` that are source, not build output)
- **Pass Condition**: `find packages -path '*/src/*.js'` returns nothing
- **Evidence**: find command output

### AC-10: Build and test pass
- **Type**: `rule`
- **Given**: a clean clone with `npm install`
- **When**: `npm run build && npm test`
- **Then**: both exit 0
- **Pass Condition**: exit code 0 for both
- **Evidence**: CI-style command run

### AC-11: UI works at non-default mount path
- **Type**: `rule`
- **Given**: docs mounted at `/api-docs/sockets`
- **When**: opening it in a browser
- **Then**: `spec.json` resolves relative and the UI renders with all assets loading
- **Pass Condition**: no 404s on assets; events render
- **Evidence**: manual check + vite `base: "./"`

### AC-12: Authorize sends auth in handshake
- **Type**: `rule`
- **Given**: the example server checks `socket.handshake.auth.token`
- **When**: user sets Bearer token in Authorize modal and connects
- **Then**: the handshake includes `auth.token` and the server accepts
- **Pass Condition**: connection succeeds with correct token, fails without
- **Evidence**: example app manual test

### AC-13: Existing UI look and feel preserved
- **Type**: `rubric`
- **Dimension**: visual/layout fidelity to the existing UI
- **Scale**: 1-5
- **Anchors**: 1 = unrecognizable redesign; 3 = same components but restyled; 5 = identical layout, badges, colors, theme toggle, only data/behavior fixed
- **Pass Threshold**: >= 4
- **Evidence**: screenshot comparison or code review of Tailwind classes retained

## Open Questions
- [ ] NestJS server→client sniffing: is the gateway Socket.IO server reachable reliably? If not, document that server→client must be declared. (Will decide in Phase 6 and record in DECISIONS.md.)
- [ ] Phase 8 CLI: include if low complexity; otherwise skip. (Decide in Phase 8.)
