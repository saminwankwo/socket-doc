# SocketDocs Redesign: "Swagger for Sockets"

> Paste this whole file into Claude Code at the root of the `socketdocs` repo.

---

## 0. Your role and ground rules

You are refactoring the `socketdocs` monorepo (currently v0.3.0) into a **code-first, Swagger-style documentation tool for Socket.IO**. You have full access to the repo. Work autonomously through the phases below.

**Rules**

1. Create and work on a branch: `redesign/swagger-for-sockets`.
2. Breaking changes are allowed. This becomes `1.0.0-alpha.0`. No backwards-compat shims.
3. **One commit per phase**, message format `phase N: <summary>`.
4. At the end of every phase run `npm run build && npm test`. If either fails, fix it before moving on. Never leave a phase red.
5. Do not invent features outside this document. If something is ambiguous, pick the simplest option, note it in `DECISIONS.md` (append as you go), and continue.
6. Keep the existing React UI (`packages/docs-server`). Its look and feel, layout, theme toggle, event cards, and Try-it flow are **liked by the owner and must be preserved**. You are fixing its data pipeline and adding to it, not redesigning it.
7. When finished, print a summary: what changed per phase, what was deleted, how to run both example apps, and any open issues.

---

## 1. Goal and target experience

A developer with an existing Express + Socket.IO server should be able to do this:

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
  path: '/socket-docs',
  title: 'Chat API',
  version: '1.0.0',
  description: 'Realtime chat',
});

// Optional enrichment. Without this, events are still discovered automatically (names only).
docs.event('send_message', {
  summary: 'Send a message to a room',
  payload: z.object({ text: z.string(), roomId: z.string() }),
  response: z.object({ ok: z.boolean() }),
  errors: [{ code: 'INVALID_ROOM', description: 'Room does not exist' }],
});

server.listen(3000);
```

Then open `http://localhost:3000/socket-docs` and get:

- Every event the server handles, listed automatically (**auto-sniffing**), even with zero config.
- Richer docs for any event they enriched with `docs.event(...)` (**declared**).
- The existing UI with expandable event cards, a **Try it out** flow, an **Authorize** button, and a live event log.

NestJS gets the same through `SocketDocsModule.setup("/socket-docs", app, config)`, mirroring `SwaggerModule.setup`. It reads existing `@WebSocketGateway` / `@SubscribeMessage` metadata automatically, plus an optional `@SocketEvent({...})` decorator for details.

---

## 2. Known problems this redesign must fix

These come from the architecture report. Every one must be resolved or explicitly removed.

1. **Three diverging schema shapes** (fluent `Contract`, flat `SocketDocsSchema`, `generateSpec()` output). Collapse to **one**.
2. **`/schema.json` returns the wrong shape for the React UI.** The server returns `SocketDocsSchema`, the UI expects the `generateSpec()` shape, so the SPA renders nothing.
3. **The React UI is never shipped.** `docs-server` is `private`, and `@socketdocs/server` resolves `../../docs-server/dist` by relative path, which breaks after `npm publish`.
4. **Playground connection logic is wrong.** `io(socketUrl, { path: ns === 'default' ? '/socket.io' : '/' + ns })` treats the _namespace_ as the engine `path`. Namespaces must go in the URL (`io(origin + "/chat", { path: "/socket.io" })`).
5. **`socketUrl` defaults to `http://localhost:3000`.** It must be inferred from `window.location`.
6. **No auto-discovery.** Nothing reads a running Socket.IO server or existing NestJS gateways.
7. Stale compiled `index.js` / `index.d.ts` committed inside `packages/ws/src` and `packages/fastify/src`.
8. CHANGELOG claims CLI commands (`serve`, `build`, `validate`) that don't exist.
9. `examples/*` workspace glob with no `examples/` directory.
10. Dual test configs (vitest + jest) in core.
11. Dead code: `onSpecGenerated`, `registerNamespaceClass` (drops schemas), core `decorators.ts`, Go SDK stub.

---

## 3. Target architecture

### Packages after the redesign

| Package               | Path               | Role                                                                                                                         |
| --------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `@socketdocs/core`    | `packages/core`    | Spec model, schema normalization (Zod/JSON Schema), event registry, optional lint + AsyncAPI export                          |
| `@socketdocs/express` | `packages/express` | `SocketDocs.setup(app, io, opts)`: Socket.IO instrumentation (sniffing), serves `spec.json` and the bundled UI               |
| `@socketdocs/nestjs`  | `packages/nestjs`  | `SocketDocsModule.setup(...)`, gateway discovery, `@SocketEvent` decorator                                                   |
| `@socketdocs/ui`      | `packages/ui`      | The existing React SPA, renamed from `docs-server`; its build output is **bundled into `@socketdocs/express`** at build time |

**Delete:** `packages/ws`, `packages/fastify`, `packages/socket-io` (the old validating adapter), and the old `packages/server` (replaced by `packages/express`). Also delete: SDK generators, mock server, plugin system, `validate-contract`, `generateHtml()` as a full UI, and the legacy `socketdocs.json` / `SocketDocsSchema` / fluent `createContract` path. Git history preserves everything.

### The single spec model (`packages/core/src/spec.ts`)

Base it on the **existing `generateSpec()` shape**, since the UI already consumes it, and name it `SocketDocsSpec`:

```ts
export type Direction =
  'client_to_server' | 'server_to_client' | 'bidirectional';
export type EventKind = 'fire_and_forget' | 'request_response';
export type EventSource = 'sniffed' | 'declared' | 'decorator';

export interface ErrorSpec {
  code: string | number;
  description: string;
}

export interface SecuritySpec {
  name: string;
  type: 'apiKey' | 'http' | 'oauth2';
  in?: 'header' | 'query' | 'cookie' | 'auth'; // "auth" = Socket.IO handshake `auth` payload
  description?: string;
}

export interface EventSpec {
  name: string;
  namespace: string; // e.g. "/" or "/chat"
  direction: Direction;
  kind?: EventKind; // request_response if an ack callback was observed/declared
  summary?: string;
  description?: string;
  payloadSchema?: Record<string, unknown>; // JSON Schema
  responseSchema?: Record<string, unknown>; // JSON Schema (ack payload)
  examples?: unknown[];
  errors?: ErrorSpec[];
  tags?: string[];
  deprecated?: boolean;
  authRequired?: boolean;
  source: EventSource;
}

export interface NamespaceSpec {
  name: string;
  description?: string;
  events: Record<string, EventSpec>;
}

export interface SocketDocsSpec {
  specVersion: '1.0';
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; label?: string }>;
  socketPath?: string; // engine path, default "/socket.io"
  security?: SecuritySpec[];
  namespaces: Record<string, NamespaceSpec>;
}
```

### Normalization (`packages/core/src/normalize.ts`)

- `normalizeSchema(input: ZodTypeAny | JSONSchema | undefined): JSONSchema | undefined`: Zod goes through `zod-to-json-schema`, a plain object is treated as JSON Schema, and `undefined` returns `undefined`. **Conversion happens at registration time**, not at spec-generation time.
- `class EventRegistry`: holds the spec in memory. Methods: `observe(ns, eventName, info)` (from sniffing; never overwrites declared fields), `declare(ns, eventName, def)` (merges over sniffed data, sets `source: "declared"`), `toSpec()`, and an `onChange` emitter. Merge rule: **declared fields win; sniffed data only fills blanks**; `source` becomes `"declared"` once declared.

---

## 4. Phases

### Phase 1: Branch, cleanup, housekeeping

1. Create branch `redesign/swagger-for-sockets`; create `DECISIONS.md`.
2. Delete `packages/ws`, `packages/fastify`, `packages/socket-io`. Delete committed `*.js`/`*.d.ts` build artifacts in any `src/`. Update root `tsconfig.json` references and workspace globs.
3. Choose **vitest** as the only test runner. Delete `jest.config.cjs` and any jest deps in core. Add a root `npm test` that runs vitest across workspaces.
4. Create `examples/` (empty for now; examples come in Phase 7) so the workspace glob is valid.
5. Add `.gitignore` entries for `dist/`, `*.tsbuildinfo`, `packages/express/ui-dist/`.
6. Rewrite `CHANGELOG.md`: remove the false claims; add a `1.0.0-alpha.0` entry stating the redesign.

**Done when:** build and test pass on the trimmed repo.

### Phase 2: Core, the unified spec model and registry

1. In `packages/core/src`, delete: `contract.ts` (fluent contract, converters, `generateSpec`), `decorators.ts`, `plugins.ts`, `validation.ts`, `ui.ts` (`generateHtml`).
2. Add `spec.ts` (types above), `normalize.ts` (`normalizeSchema`), `registry.ts` (`EventRegistry`).
3. Keep and **port** `lint.ts` and `asyncapi.ts` to operate on `SocketDocsSpec`. While porting: map `errors` into AsyncAPI, use `spec.servers` instead of hardcoding localhost, and fix lint rules that referred to removed fields. Export them as `lintSpec(spec)` and `toAsyncApi(spec)`.
4. Export a clean public API from `index.ts`: all spec types, `EventRegistry`, `normalizeSchema`, `lintSpec`, `toAsyncApi`.
5. Write vitest tests:
   - `normalizeSchema`: Zod object, nested Zod, raw JSON Schema, undefined.
   - `EventRegistry`: observe-then-declare merge, declare-then-observe (declared wins), `source` transitions, multiple namespaces, `toSpec()` shape.
   - `lintSpec` and `toAsyncApi` on a small fixture spec.

**Done when:** core builds, tests pass, and nothing in core imports Socket.IO or Express.

### Phase 3: UI, bundle it and fix the data pipeline

Goal: the **existing** UI shows real data and ships inside the published package.

1. Rename `packages/docs-server` → `packages/ui`, package name `@socketdocs/ui`. It stays `private: true` (it is bundled, not published separately).
2. Vite config: set `base: "./"` so asset URLs are relative and work under **any** mount path.
3. Change the data fetch to `fetch("./spec.json")` and type the result as `SocketDocsSpec` from core (import types only). Remove any assumptions about the old `schema.json`.
4. **Fix the connection logic** (see Problem 4): connect with `io(origin + namespaceName, { path: spec.socketPath ?? "/socket.io", auth })`. For namespace `"/"` use `origin` alone.
5. **Fix the default URL** (see Problem 5): default the server URL input to `window.location.origin`; if `spec.servers[0]` exists, offer it as a dropdown option. The user can still edit the URL.
6. Handle the empty state gracefully: when `spec.namespaces` has no events, show a friendly panel: "No events discovered yet. Events appear here after the first client connects to your server, or you can declare them with `docs.event(...)`." Add a **Refresh** button that re-fetches `spec.json`.
7. Show the `source` of each event as a small badge (`auto-discovered` vs `documented`) so users can see which events need enrichment. Style it to match the existing badges.
8. Add `build:ui` script; root `npm run build` must run it after the TS build.

**Done when:** `npm run build` produces `packages/ui/dist`, and opening it against a hand-written fixture `spec.json` renders events correctly.

### Phase 4: `@socketdocs/express`, mount, sniffing, serving

Create `packages/express` (you may start from `packages/server`, then delete that package).

**4a. Public API**

```ts
SocketDocs.setup(app: Express, io: SocketIOServer, options: SocketDocsOptions): SocketDocsInstance

interface SocketDocsOptions {
  path?: string;                 // default "/socket-docs"
  title: string;
  version: string;
  description?: string;
  servers?: Array<{ url: string; label?: string }>;
  security?: SecuritySpec[];
  socketPath?: string;           // default: io.path() or "/socket.io"
  auth?: { username: string; password: string } | express.RequestHandler;  // protects the docs page
  sniff?: boolean;               // default true
  captureExamples?: boolean;     // default false; stores one sample payload per event from live traffic
}

interface SocketDocsInstance {
  event(name: string, def: EventDeclaration, opts?: { namespace?: string }): this;  // namespace default "/"
  namespace(name: string, description?: string): this;
  registry: EventRegistry;
  spec(): SocketDocsSpec;
}

interface EventDeclaration {
  summary?: string; description?: string;
  direction?: Direction;
  payload?: ZodTypeAny | JSONSchema;
  response?: ZodTypeAny | JSONSchema;
  examples?: unknown[]; errors?: ErrorSpec[]; tags?: string[];
  deprecated?: boolean; authRequired?: boolean;
}
```

`docs.event(...)` **describes only**. It must not register handlers or validate payloads.

**4b. Routes** (mounted via `app.use(path, router)`)

- `GET <path>` without trailing slash → 301 redirect to `<path>/` (required so relative `./spec.json` resolves correctly).
- `GET <path>/spec.json` → `registry.toSpec()` (always current).
- Static files from the bundled UI directory; SPA fallback to `index.html`.
- If `auth` is set, apply it to **all** of the above.

**4c. Bundling the UI into the package**

- Add a build step in `packages/express` that copies `packages/ui/dist` → `packages/express/ui-dist` after the UI build.
- Resolve the directory at runtime relative to the package's own `dist` file (use `import.meta.url` / `__dirname`-equivalent against `../ui-dist`), **not** into a sibling package.
- Add `ui-dist` to `files` in `package.json`.
- If `ui-dist` is missing at runtime, serve a tiny HTML page saying the UI bundle is missing, with a rebuild hint. This replaces the old `generateHtml()`.
- Verify with `npm pack` in `packages/express`: the tarball must contain `ui-dist/index.html`. Add this check as a test or script.

**4d. Auto-sniffing (`instrument.ts`)**

Goal: record events without the user declaring them.

- Hook every namespace: the default `io.sockets`, all existing `io._nsps` entries, and future ones via `io.on("new_namespace", ...)`. Use public APIs where possible; if a private field is needed, isolate it in one function with a comment and a defensive fallback.
- For each connected socket (`namespace.on("connection", socket => ...)`):
  - **Incoming (client → server):** patch `socket.on` (and `socket.once`) with a wrapper that records the event name via `registry.observe(ns, name, { direction: "client_to_server" })`, then calls through to the original. The wrapper must also wrap the listener so that when the listener is invoked and the **last argument is a function**, the event is marked `kind: "request_response"` (an ack was used). It must not change handler behavior or swallow errors.
  - **Ignore reserved events:** `connect`, `connect_error`, `disconnect`, `disconnecting`, `error`, `newListener`, `removeListener`.
  - **Outgoing (server → client):** if `socket.onAnyOutgoing` exists (Socket.IO ≥ 4.5), record each emitted event name as `server_to_client`. If the same name is both received and emitted, direction becomes `bidirectional`. Guard with a feature check and fall back silently on older versions.
  - If `captureExamples` is true, use `socket.onAny` to store the first JSON-serializable payload per event as an example, truncated to a safe size, with obvious secret keys (`password`, `token`, `authorization`, `secret`) redacted.
- Sniffing must never throw into user code. Wrap every observer in try/catch.
- Document the **limitation** in the README: events appear after the first client connection, because Socket.IO handlers are registered inside the `connection` callback. The Try-it-out client connecting from the docs page counts as that first connection.

**4e. Tests (vitest, real Socket.IO server + `socket.io-client`)**

- Mounting: `GET /socket-docs` redirects; `spec.json` has the right shape; the UI index is served.
- Sniffing: connect a client to a server that has `socket.on("ping", (data, ack) => ...)`; spec shows `ping`, `client_to_server`, `request_response` after the event fires or is registered.
- Namespaces: a custom namespace `/chat` appears under `namespaces["/chat"]`.
- Declared enrichment overrides sniffed fields; `source` is `declared`.
- Reserved events are excluded.
- Sniffing doesn't break handler behavior (ack still works, errors still propagate).
- Auth: Basic auth rejects without credentials, accepts with.

**Done when:** all tests pass and `npm pack` verification passes.

### Phase 5: UI, Swagger-style "Try it out" and Authorize

The current UI already has a playground and Try-it flow. **Keep what exists and make it behave like Swagger.** Audit first: read `App.tsx` and list what exists before changing anything. Then:

1. Split the 576-line `App.tsx` into components without changing visuals: `Sidebar`, `EventCard`, `TryItOut`, `AuthorizeModal`, `ConnectionBar`, `EventLog`, `SchemaView`, plus a `useSocketClient` hook for connection state. Keep the Tailwind classes and theme behavior.
2. **Event cards (inline Try it out):** each event card expands in place to show: summary/description, payload schema, response schema, examples, errors, and a **Try it out** button. Clicking it reveals:
   - A JSON editor prefilled from `examples[0]` if present, otherwise generated from `payloadSchema` (write a small `sampleFromSchema()` helper handling object/array/string/number/integer/boolean/enum/default/format basics).
   - **Execute** button: emits the event to that event's namespace; if `kind === "request_response"` (or unknown), pass an ack callback and display the ack response; show a timeout message after 10 s with no ack.
   - Basic client-side JSON syntax validation with an inline error. (No schema validation required.)
3. **Authorize button** (top bar, Swagger style): modal to set auth for the handshake. Support these modes: None, Bearer token (`auth: { token }`), API key (`auth: { apiKey }`), and **Custom** (free-form JSON merged into `auth`). Also optional query params (`query`). Respect `spec.security` entries to prefill the right field names. Persist auth in `sessionStorage` (wrapped in try/catch). After changing auth, reconnect.
4. **Connection bar:** server URL (default `window.location.origin`, see Phase 3), connect/disconnect, status indicator, and a namespace picker (from `spec.namespaces`). One socket per namespace is created lazily on first use and reused.
5. **Listen toggle** for `server_to_client` and `bidirectional` events: when on, subscribe with `socket.on(eventName, ...)` and log incoming payloads; when off, unsubscribe.
6. **Live event log** (bottom drawer or right panel, matching the current color-coded in/out/error/info entries): timestamps, direction, event name, namespace, payload (collapsible JSON), clear button, auto-scroll toggle, and a filter by event name.
7. Add a short note in the UI near Authorize: browsers can't set custom WebSocket headers, so auth is sent through the Socket.IO `auth` payload or query params.
8. Keep dark/light toggle and the sidebar search working. Search should filter by event name, summary, and tag.
9. Add component tests with vitest + @testing-library/react for `sampleFromSchema` and for `TryItOut` (mock the socket client).

**Done when:** against the Phase 4 test server, a user can open the docs, click Authorize, expand `ping`, press Try it out → Execute, and see the ack in the card and the entry in the log.

### Phase 6: `@socketdocs/nestjs`, discovery and decorator

Rewrite `packages/nestjs` (reuse what works; the existing module already uses `DiscoveryService` + `MetadataScanner`).

**6a. API**

```ts
SocketDocsModule.setup(path: string, app: INestApplication, config: SocketDocsConfig): Promise<SocketDocsInstance> | SocketDocsInstance

// optional enrichment decorator, placed alongside @SubscribeMessage
@SocketEvent({
  summary: "Send a message to a room",
  payload: z.object({ ... }) /* or JSON Schema */,
  response: z.object({ ... }),
  errors: [...], tags: [...], deprecated?: boolean, authRequired?: boolean,
})
```

`SocketDocsConfig` mirrors the Express options (`title`, `version`, `description`, `servers`, `security`, `auth`, `socketPath`).

**6b. Discovery**

- Use `DiscoveryService` to find providers annotated with the gateway metadata (`GATEWAY_METADATA` from `@nestjs/websockets/constants`). Read `namespace` from gateway options (default `"/"`).
- For each method with `MESSAGE_MAPPING_METADATA`, read the event name, set `direction: "client_to_server"`, `source: "decorator"` (or `"declared"` if `@SocketEvent` is present, and merge its fields through `normalizeSchema`).
- If a handler method has a `@Ack`-style parameter or the return value is a non-void, you may mark `kind: "request_response"`; if that can't be determined reliably, leave `kind` unset. Do not guess.
- Because NestJS gateways are discoverable **at startup**, events must appear **before any client connects** (unlike Express sniffing). Add a test for this.
- Mount the same router/UI as the Express package: **extract the shared "router + bundled UI" logic into one place** (put `createDocsRouter(registry, options)` in `@socketdocs/express` and have `@socketdocs/nestjs` depend on it), so there is only one implementation of routes, auth, and static serving. Get the Express instance via `app.getHttpAdapter().getInstance()`; throw a clear error if the adapter isn't Express.
- Also run the Socket.IO sniffer for Nest if the gateway server is reachable, to catch `server_to_client` events; if not feasible, document that only client→server events are auto-discovered in Nest and server→client events must be declared with `@SocketEvent({ direction: "server_to_client" })` on a method or via `docs.event(...)`. Pick whichever is reliable and note it in `DECISIONS.md`.

**6c. Tests**

Use `@nestjs/testing` with a small gateway fixture: namespace discovery, event discovery, `@SocketEvent` merge, `spec.json` served, and events present before any client connects.

### Phase 7: Example apps and docs

1. `examples/express-chat`: a small Express + Socket.IO chat server (default namespace plus `/chat`), one fully declared event, one deliberately undeclared event (to show sniffing), an ack-based event, and an auth check using the handshake `auth.token`. Include a README with run steps and what to click in the UI. This is the owner's manual test bed.
2. `examples/nest-chat`: a minimal NestJS gateway app with two `@SubscribeMessage` handlers, one using `@SocketEvent`.
3. Rewrite the root `README.md`:
   - What it is (one paragraph: "Swagger for Socket.IO").
   - 60-second Express quickstart (the snippet in section 1).
   - NestJS quickstart.
   - How auto-discovery works and its limitation (Express: after first connection; Nest: at startup).
   - Declaring events (`docs.event`, `@SocketEvent`), Zod and JSON Schema.
   - Auth: protecting the docs page, and the Authorize button.
   - A "Limitations" section (header auth, sniffing timing, Socket.IO v4 only).
   - A screenshot placeholder section.
4. Update each package's `package.json` (`files`, `exports`, `types`, `peerDependencies` for `express`, `socket.io`, and `@nestjs/*` as peers, not deps) and add a per-package README.
5. Run an end-to-end manual-style check with a script: start `examples/express-chat`, fetch `/socket-docs/spec.json`, assert known events exist.

### Phase 8 (optional, only if everything above is green): small CLI

Replace the old CLI with a minimal `socketdocs` binary:

- `socketdocs lint --url http://localhost:3000/socket-docs/spec.json` (or `--file spec.json`): runs `lintSpec`, exits 1 on errors.
- `socketdocs export-asyncapi --url ... -o asyncapi.json`: runs `toAsyncApi`.

Fetch the spec from the live server; **do not** load `.ts` contracts. If this adds meaningful complexity, skip it and say so in `DECISIONS.md`.

---

## 5. Final acceptance checklist

Verify every item and report pass/fail in your final summary:

- [ ] `npm install && npm run build && npm test` pass from a clean clone.
- [ ] Only one spec model (`SocketDocsSpec`) exists; `/spec.json` is exactly what the UI reads.
- [ ] `npm pack` of `@socketdocs/express` contains the built UI, and the UI works when the package is installed from the tarball into a throwaway project (try it with `examples/express-chat` using the packed tarball).
- [ ] The UI works when mounted at a non-default path (e.g. `/api-docs/sockets`) and with/without trailing slash.
- [ ] Express: undeclared events are auto-discovered; declared events are enriched; reserved events excluded.
- [ ] Nest: gateway events appear before any client connects.
- [ ] Playground connects to a custom namespace correctly (namespace in URL, engine path separate) and uses `window.location.origin` by default.
- [ ] Authorize modal sends auth in the handshake, and the example server's token check accepts/rejects accordingly.
- [ ] Try it out shows ack responses; the Listen toggle shows server-pushed events; the event log works.
- [ ] No stale compiled files in any `src/`; no jest config; no references to deleted packages; CHANGELOG matches reality.
- [ ] `DECISIONS.md` lists every judgment call made.

Start with Phase 1 now.
