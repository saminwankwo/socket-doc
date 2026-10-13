# SocketDocs Redesign - Implementation Plan

## Task 1: Branch, cleanup, housekeeping (Phase 1)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: None
- **Description**:
  - Create branch `redesign/swagger-for-sockets`, add `DECISIONS.md`.
  - Delete `packages/ws`, `packages/fastify`, `packages/socket-io`; remove committed `*.js`/`*.d.ts` build artifacts from any `src/`.
  - Update root `tsconfig.json` references and workspace globs; remove `examples/*` if empty glob issue, create `examples/` placeholder.
  - Choose vitest only: delete `jest.config.cjs` and jest deps; root `npm test` runs vitest across workspaces.
  - Add `.gitignore` entries: `dist/`, `*.tsbuildinfo`, `packages/express/ui-dist/`.
  - Rewrite `CHANGELOG.md`: remove false claims; add `1.0.0-alpha.0` redesign entry.
- **Acceptance Criteria Addressed**: AC-9, AC-10
- **Test Requirements**:
  - `rule` TR-1.1: `npm run build && npm test` exit 0 on trimmed repo. Evidence: command output.
  - `rule` TR-1.2: `find packages -path '*/src/*.js'` returns nothing. Evidence: command output.
  - `rule` TR-1.3: no `jest.config.cjs` exists; `package.json` has no jest deps. Evidence: ls + grep.
- **Notes**: Deletions are permanent; git history preserves old code.

## Task 2: Core unified spec model + registry (Phase 2)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 1
- **Description**:
  - In `packages/core/src`, delete `contract.ts`, `decorators.ts`, `plugins.ts`, `validation.ts`, `ui.ts`.
  - Add `spec.ts` (types: `Direction`, `EventKind`, `EventSource`, `ErrorSpec`, `SecuritySpec`, `EventSpec`, `NamespaceSpec`, `SocketDocsSpec`), `normalize.ts` (`normalizeSchema`), `registry.ts` (`EventRegistry` with `observe`, `declare`, `toSpec`, onChange).
  - Port `lint.ts` and `asyncapi.ts` to `SocketDocsSpec`: map errors into AsyncAPI, use `spec.servers`, fix removed-field rules. Rename exports `lintSpec`, `toAsyncApi`.
  - Rewrite `index.ts` public API: spec types, `EventRegistry`, `normalizeSchema`, `lintSpec`, `toAsyncApi`.
  - Write vitest tests: `normalizeSchema` (Zod/nested/raw/undefined), `EventRegistry` (observe-then-declare merge, declare-then-observe declared wins, source transitions, multiple namespaces, toSpec shape), `lintSpec` + `toAsyncApi` on a fixture.
- **Acceptance Criteria Addressed**: AC-1, AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-2.1: core builds with `tsc` and no imports of socket.io/express. Evidence: build output + grep.
  - `rule` TR-2.2: vitest tests for normalize/registry/lint/asyncapi all pass. Evidence: vitest output.
  - `rule` TR-2.3: core `index.ts` exports only `SocketDocsSpec`, `EventRegistry`, `normalizeSchema`, `lintSpec`, `toAsyncApi` and spec types; no `createContract`/`SocketDocsSchema`. Evidence: grep dist/index.d.ts.
- **Notes**: Conversion happens at registration time, not spec generation.

## Task 3: UI rename + data pipeline + connection fixes (Phase 3)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 2
- **Description**:
  - Rename `packages/docs-server` → `packages/ui`, package `@socketdocs/ui`, keep `private: true`.
  - Vite `base: "./"`.
  - Data fetch: `fetch("./spec.json")`, type as `SocketDocsSpec` (import types only from core). Remove `schema.json` assumptions.
  - Fix connection: `io(origin + namespaceName, { path: spec.socketPath ?? "/socket.io", auth })`; namespace `"/"` → origin alone.
  - Default URL: `window.location.origin`; if `spec.servers[0]` show dropdown.
  - Empty state: friendly panel + Refresh button re-fetching `spec.json`.
  - Event `source` badge (`auto-discovered` vs `documented`).
  - Add `build:ui` script; root `npm run build` runs it after TS build.
- **Acceptance Criteria Addressed**: AC-2, AC-6, AC-7, AC-11, AC-13
- **Test Requirements**:
  - `rule` TR-3.1: `npm run build` produces `packages/ui/dist`. Evidence: ls.
  - `rule` TR-3.2: UI renders events from a fixture `spec.json`. Evidence: manual or component test.
  - `rule` TR-3.3: socket constructor called with namespace in URL, engine path separate. Evidence: component test with mocked io.
  - `rule` TR-3.4: default server URL equals `window.location.origin`. Evidence: component test.
  - `rubric` TR-3.5: UI visual fidelity; scale 1-5; anchors 1/3/5; threshold >=4; evidence: retained Tailwind classes + layout.
- **Notes**: Preserve existing look/feel; only fix data pipeline and connection logic.

## Task 4: @socketdocs/express - setup, routes, sniffing, UI bundle (Phase 4)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 3
- **Description**:
  - Create `packages/express` from `packages/server`, then delete `packages/server`.
  - Public API: `SocketDocs.setup(app, io, opts)` → `SocketDocsInstance` (`event`, `namespace`, `registry`, `spec`).
  - Routes: redirect no-trailing-slash, `GET /spec.json` → `registry.toSpec()`, static UI + SPA fallback, optional auth (Basic or middleware) on all routes.
  - Bundle UI: build step copies `packages/ui/dist` → `packages/express/ui-dist`; runtime resolves `../ui-dist` relative to package's own dist; add `ui-dist` to `files`; missing-bundle fallback HTML page.
  - `npm pack` verification test/script: tarball contains `ui-dist/index.html`.
  - Auto-sniffing (`instrument.ts`): hook all namespaces (default, existing, future via `new_namespace`); patch `socket.on`/`socket.once` to record event name + ack detection; `socket.onAnyOutgoing` for server→client; reserved events excluded; `captureExamples` with redaction; all in try/catch.
  - vitest integration tests (real socket.io server + client): mounting routes, sniffing client→server + ack, namespaces, declared-overrides-sniffed, reserved excluded, handler behavior intact, auth.
- **Acceptance Criteria Addressed**: AC-1, AC-2, AC-3, AC-4, AC-5, AC-10, AC-11
- **Test Requirements**:
  - `rule` TR-4.1: `GET /socket-docs` redirects to `/socket-docs/`; `GET /socket-docs/spec.json` returns `SocketDocsSpec`. Evidence: integration test.
  - `rule` TR-4.2: sniffing records `ping` as `client_to_server` + `request_response` after client emit. Evidence: integration test.
  - `rule` TR-4.3: declared event has `source: "declared"` and declared fields present. Evidence: integration test.
  - `rule` TR-4.4: reserved events not in spec. Evidence: integration test.
  - `rule` TR-4.5: `npm pack` tarball contains `ui-dist/index.html`. Evidence: pack script/test.
  - `rule` TR-4.6: sniffing doesn't break ack or error propagation. Evidence: integration test.
- **Notes**: Use public Socket.IO APIs where possible; isolate private-field access with comment + fallback.

## Task 5: UI Swagger-style Try it out + Authorize (Phase 5)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Split `App.tsx` into components: `Sidebar`, `EventCard`, `TryItOut`, `AuthorizeModal`, `ConnectionBar`, `EventLog`, `SchemaView`, `useSocketClient` hook. Keep visuals/theme.
  - Event cards inline Try-it-out: summary, payload/response schema, examples, errors, Try button → JSON editor prefilled from `examples[0]` or `sampleFromSchema(payloadSchema)`, Execute emits to event's namespace, ack handling with 10s timeout, client-side JSON syntax validation.
  - Authorize modal: None/Bearer/API key/Custom JSON + query params; respect `spec.security` field names; persist to `sessionStorage` (try/catch); reconnect on change.
  - Connection bar: URL (default origin), connect/disconnect, status, namespace picker; one socket per namespace lazily.
  - Listen toggle for server→client/bidirectional events; subscribe/unsubscribe.
  - Live event log: timestamps, direction, event, namespace, collapsible JSON payload, clear, auto-scroll toggle, filter by event name.
  - Note near Authorize about browser WS header limitation.
  - Keep search (event name/summary/tag) and theme toggle.
  - Component tests: `sampleFromSchema`, `TryItOut` (mocked socket client).
- **Acceptance Criteria Addressed**: AC-2, AC-6, AC-7, AC-12, AC-13
- **Test Requirements**:
  - `rule` TR-5.1: `sampleFromSchema` handles object/array/string/number/integer/boolean/enum/default/format. Evidence: unit test.
  - `rule` TR-5.2: TryItOut Execute calls socket.emit with ack; timeout shown after 10s. Evidence: component test.
  - `rule` TR-5.3: Authorize modal sets auth in handshake; reconnect after change. Evidence: component test with mocked io.
  - `rule` TR-5.4: Listen toggle subscribes/unsubscribes server→client events. Evidence: component test.
  - `rubric` TR-5.5: UI fidelity; scale 1-5; threshold >=4; evidence: retained classes.
- **Notes**: Do not redesign visuals; split and add behavior only.

## Task 6: @socketdocs/nestjs - gateway discovery + decorator (Phase 6)
- **Status**: `pending`
- **Priority**: high
- **Depends On**: Task 4
- **Description**:
  - Rewrite `packages/nestjs`: `SocketDocsModule.setup(path, app, config)`, `@SocketEvent({...})` decorator.
  - Discovery: `DiscoveryService` finds providers with `GATEWAY_METADATA`; read namespace from gateway options (default `/`); for methods with `MESSAGE_MAPPING_METADATA`, read event name, `direction: client_to_server`, `source: decorator`; if `@SocketEvent` present, merge fields via `normalizeSchema`, set `source: declared`.
  - Mark `kind: request_response` only if reliably detectable (ack param or non-void return); else leave unset.
  - Reuse Express router: extract `createDocsRouter(registry, options)` into `@socketdocs/express`; nestjs depends on it. Get Express instance via `app.getHttpAdapter().getInstance()`; clear error if not Express.
  - Decide on server→client sniffing for Nest: if gateway Socket.IO server reachable, run sniffer; else document limitation in DECISIONS.md.
  - Tests (`@nestjs/testing`): namespace discovery, event discovery, `@SocketEvent` merge, `spec.json` served, events present before client connects.
- **Acceptance Criteria Addressed**: AC-8, AC-10
- **Test Requirements**:
  - `rule` TR-6.1: gateway events appear in spec before any client connects. Evidence: nest testing test.
  - `rule` TR-6.2: `@SocketEvent` fields merged into spec with `source: declared`. Evidence: test.
  - `rule` TR-6.3: `spec.json` served via the same router. Evidence: test.
  - `rule` TR-6.4: clear error thrown if HTTP adapter is not Express. Evidence: test.
- **Notes**: Record server→client sniffing decision in DECISIONS.md.

## Task 7: Example apps + docs + package metadata (Phase 7)
- **Status**: `pending`
- **Priority**: medium
- **Depends On**: Task 5, Task 6
- **Description**:
  - `examples/express-chat`: Express + Socket.IO, default ns + `/chat`, one declared event, one undeclared (sniffing demo), ack event, handshake `auth.token` check. README with run steps.
  - `examples/nest-chat`: minimal NestJS gateway, two `@SubscribeMessage`, one `@SocketEvent`.
  - Rewrite root `README.md`: what it is, Express quickstart, NestJS quickstart, auto-discovery + limitation, declaring events, auth, limitations, screenshot placeholder.
  - Update each package `package.json` (`files`, `exports`, `types`, peerDependencies for express/socket.io/@nestjs/*).
  - Per-package README.
  - End-to-end check script: start express-chat, fetch `/socket-docs/spec.json`, assert known events.
- **Acceptance Criteria Addressed**: AC-10, AC-12
- **Test Requirements**:
  - `rule` TR-7.1: `examples/express-chat` starts and `spec.json` contains declared + sniffed events. Evidence: e2e script.
  - `rule` TR-7.2: `examples/nest-chat` starts and `spec.json` contains gateway events. Evidence: e2e script or manual.
  - `rule` TR-7.3: peerDependencies set correctly; no express/socket.io as hard deps in express package. Evidence: grep package.json.
- **Notes**: Examples are the owner's manual test bed.

## Task 8: Minimal CLI (Phase 8, optional)
- **Status**: `pending`
- **Priority**: low
- **Depends On**: Task 2
- **Description**:
  - Replace old CLI with minimal `socketdocs` binary: `lint --url|--file`, `export-asyncapi --url -o`.
  - Fetch spec from live server or file; do not load `.ts` contracts.
  - If complexity is high, skip and record in DECISIONS.md.
- **Acceptance Criteria Addressed**: AC-10
- **Test Requirements**:
  - `rule` TR-8.1: `socketdocs lint --file spec.json` exits 1 on lint errors. Evidence: test.
  - `rule` TR-8.2: `socketdocs export-asyncapi --file spec.json -o out.json` writes valid AsyncAPI. Evidence: test.
- **Notes**: Optional; skip if it adds meaningful complexity.
