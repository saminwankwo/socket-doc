# DECISIONS

Judgment calls made during the `1.0.0-alpha.0` redesign.

## Phase 1

- **Deleted `packages/cli`, `packages/server`, `packages/nestjs` in Phase 1.** They import old core APIs (`createContract`, `generateHtml`, `convertContractToSocketDocsSchema`) that Phase 2 removes. Rather than maintain shims, they are recreated fresh in Phases 4, 6, and 8. The old source is preserved in git history.
- **Deleted legacy root samples `contract.ts` and `socketdocs.json`.** Not referenced by any package; they belonged to the removed contract-first path.
- **vitest only.** Removed `jest`, `ts-jest`, `@types/jest`, and `jest.config.cjs` from core and root.
- **`examples/` workspace glob kept** with a `.gitkeep` placeholder; real examples arrive in Phase 7.

## Phase 2

- **One spec model, defined once.** `SocketDocsSpec` (plus `EventSpec`, `NamespaceSpec`, `Direction`, `EventKind`, `EventSource`, `SecuritySpec`, `ErrorSpec`) lives only in `packages/core/src/spec.ts`; the express package and the UI reference those types instead of declaring their own. `/spec.json` is `registry.toSpec()` verbatim — the same shape the UI parses.
- **Deleted the whole contract-first core**: `contract.ts` (fluent `createContract`), `decorators.ts`, `plugins.ts`, `ui.ts` (`generateHtml`), `validation.ts`, `wsdoc.schema.json` and their tests, replaced by `spec.ts`, `registry.ts`, `normalize.ts` and rewritten `lint.ts` / `asyncapi.ts`.
- **`EventSpec.source` (`sniffed | declared | decorator`)** exists so the UI can badge what still needs schemas; `EventRegistry.observe()` accepts it (default `sniffed`) and never downgrades, and `declare()` always sets `declared`. Sniffing errors are swallowed inside the registry — instrumentation must never break user code.
- **Merge rules**: declared fields always win, sniffed data only fills blanks (`ensure` semantics in `observe`), and `observe()` ignores unknown fields — the sniffer cannot stomp documentation.
- **`normalizeSchema` is duck-typed on `toJSONSchema()`**: Zod v4 schemas are converted at registration time; plain objects are treated as JSON Schema and pass through; anything else is dropped. No AJV, no zod-to-json-schema dependency.
- **`zod` stays a real dependency of core** (not a peer) even though core's imports are type-only: it pins the major version the types were compiled against, and every real consumer passes zod schemas anyway.
- **`toAsyncApi` targets AsyncAPI 3.0** with `spec.servers` mapped to server objects (falling back to a `development` server), security schemes into `components.securitySchemes`, and event errors into per-message traits.

## Phase 3

- **`packages/docs-server` renamed to `packages/ui` and made private.** It is never published on its own: its Vite build is copied into `@socketdocs/express` (`ui-dist/`) at build time, so installing the server package is all a consumer needs.
- **Vite `base: './'`** so every asset URL is relative, and the SPA fetches `./spec.json` relative to the page — together this is what makes the UI work at any mount path with or without a trailing slash (re-verified at `/api-docs/sockets` during acceptance).
- **The UI depends on `@socketdocs/core` types only** (no runtime import): one shared `SocketDocsSpec` type keeps the data pipeline honest without bundling core into the browser.
- **The missing-UI fallback was replaced by a build step**: `npm run build` builds the UI first, then copies it, and `@socketdocs/express` serves a small explanatory HTML page only if `ui-dist/` is truly absent (e.g. a broken install) instead of crashing.

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

## Final acceptance

- **Bearer handshake bug fixed**: the Authorize modal sent `auth: { token: "Bearer <value>" }` (prefix included), which failed every `auth.token === <secret>` server check — including the express-chat example the README tells users to try. It now sends the raw value, matching the documented `auth: { token }` behavior. The handshake-building logic was extracted to `src/utils/handshake.ts` as a pure `buildHandshake()` (same pattern as `sampleFromSchema`) so it is unit-tested rather than trapped in the hook.
- **Leftover Vite-scaffold favicon removed** from `packages/ui/index.html`: it pointed at a nonexistent `/vite.svg` with an absolute URL that would bypass any mount path (it only "worked" because the SPA fallback served HTML for it).

## UI footer + responsive pass (`UI_FOOTER_AND_RESPONSIVE_PROMPT.md`)

- **The ~1220px "gray strip" was a real bug, not device emulation**: the Vite-scaffold `body { display: flex; place-items: center }` made `#root` a shrink-to-fit flex item, so on wide windows the app stopped at its content width (~1220–1280px) and the `:root` background (`#242424`) showed through on the right. Fixed by removing the body flex centering, giving the root `min-h-dvh w-full`, and setting the html background to the dark-theme color (`#020617`).
- **Real horizontal overflow at 360/390 was measured before adding the `overflow-x` guard** (prompt item 11): the guard was commented out during development and Playwright measured 127px of overflow at 390px — the ConnectionBar's `flex-1` URL/input group had `min-width: auto` floors (input/select intrinsic widths) that inflated it to 484px. Fixed with `min-w-0` on the group/children, `flex-wrap` inside the group, and mobile `basis-full` on the URL input and Servers select; measured `scrollWidth === innerWidth` afterwards, then re-enabled the guard.
- **Playwright spec adaptations (3)**: the tab label is scoped to `page.locator('aside')` because the header breadcrumb renders the same exact text (strict-mode violation otherwise); a 350ms settle wait plus `scrollTo(0,0)` was added before the screenshot (drawer transform + sticky header capture); `e2e/shots/` and `test-results/` are gitignored. `vitest` in `packages/ui` now runs `vitest run __tests__` so it does not pick up `e2e/*.spec.ts`.
- **`__SOCKETDOCS_VERSION__` injected via `readFileSync`** instead of the prompt's `assert { type: 'json' }` snippet — import attributes with `assert` were removed in Node ≥22; `tsconfig.node.json` gained `"types": ["node"]`. The global is declared in `src/vite-env.d.ts` and registered as `readonly` in `eslint.config.mjs` (the flat config lints all `**/*.ts(x)` with `no-undef` on).
- **EventLog no longer jumps the page on mount**: its auto-scroll effect ran with an empty log on first render, scrolling the docs page to the log (which made the sticky header paint mid-page). It now only follows when `logs.length > 0`.
- **Authorize modal footer is `sticky bottom-0`** with a solid background: at 360px the stacked Cancel/Authorize buttons were clipped below the `max-h-[90dvh]` fold (caught in the light-theme screenshot check). Authorize stacks on top of Cancel on mobile per the prompt.
- **Icon-only header buttons got accessible names** (`aria-label` on Authorize/refresh/theme/hamburger) — the Authorize label is hidden below `sm`, leaving the button nameless for screen readers and `getByRole` queries.
- **Prompt literal interpretations**: Connect/Disconnect are `basis-full` on mobile (own full-width row under the status pill); the EventLog filter is `basis-full` on mobile so Auto-scroll/Clear wrap to a second row; the "Servers..." select stacks under the URL input when the two cannot share a row (the `max-w-5xl` content column makes group1 narrower than input+select at desktop widths).
