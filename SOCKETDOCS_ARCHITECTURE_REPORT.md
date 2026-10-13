# SocketDocs — Technical Architecture Report

Repository: `socketdocs` (npm monorepo, version `0.3.0` declared in root `package.json`). Workspaces: `packages/*` and `examples/*` (no `examples/` directory actually exists despite the glob).

---

## 1. MONOREPO MAP

### Packages

| Package                   | Path                   | Purpose                                                                  | Public Exports                                                                                                                                                                                                                                                                                                                                                                                                                                      | Depends on                                                                                                                              |
| ------------------------- | ---------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `@socketdocs/core`        | `packages/core`        | Contract builder, validation, plugins, lint, AsyncAPI, HTML UI generator | `createContract`, `Contract`, `ContractOptions`, `EventDefinition`, `NamespaceDefinition`, `ErrorDefinition`, `SecurityRequirement`, `Direction`, `EventType`, `SocketEventDoc`, `SocketDocsSchema`, `convertContractToSocketDocsSchema`, `convertSocketDocsSchemaToContract`, `createValidator`, `Validator`, `SocketDocsPlugin`, `PluginManager`, `generateHtml`, `lintSpec`, `LintIssue`, `convertToAsyncApi`, `Namespace`, `Event` (decorators) | `zod`, `zod-to-json-schema`, `ajv`                                                                                                      |
| `@socketdocs/server`      | `packages/server`      | Express middleware + NestJS module to serve the docs UI and schema JSON  | `socketDocs(options)`, `SocketDocsModule.setup(...)`, `SocketDocsOptions`                                                                                                                                                                                                                                                                                                                                                                           | `@socketdocs/core`, `express` (peer-ish), `@nestjs/*` dev-only                                                                          |
| `@socketdocs/socket-io`   | `packages/socket-io`   | Socket.IO runtime adapter (validation/auth/handler binding)              | `bindSocketioAdapter`, `SocketioAdapterOptions`, `HandlerContext`, `EventHandler`, `NamespaceHandlers`, `AdapterHandlers`                                                                                                                                                                                                                                                                                                                           | `@socketdocs/core`, `socket.io`, `zod`                                                                                                  |
| `@socketdocs/ws`          | `packages/ws`          | Raw `ws` adapter + HTTP docs helper                                      | `bindWsAdapter`, `handleWsDocs`, `WsAdapterOptions`                                                                                                                                                                                                                                                                                                                                                                                                 | `@socketdocs/core`, `ws`, `zod`                                                                                                         |
| `@socketdocs/fastify`     | `packages/fastify`     | Fastify (`@fastify/websocket`) adapter + docs route                      | `bindFastifyAdapter`, `serveFastifyDocs`, `FastifyAdapterOptions`                                                                                                                                                                                                                                                                                                                                                                                   | `@socketdocs/core`, `fastify`, `@fastify/websocket`                                                                                     |
| `@socketdocs/nestjs`      | `packages/nestjs`      | NestJS decorators + module that scans providers and populates a contract | `Namespace`, `Event`, `SocketDocsModule.register`, `SocketDocsModule`                                                                                                                                                                                                                                                                                                                                                                               | `@socketdocs/core`, `@nestjs/common`, `@nestjs/core`, `@nestjs/websockets`, `reflect-metadata`                                          |
| `@socketdocs/cli`         | `packages/cli`         | CLI binary (`socketdocs`)                                                | bin entry only                                                                                                                                                                                                                                                                                                                                                                                                                                      | `@socketdocs/core`, `commander`, `jiti`, `ajv`, `ajv-formats`, `@faker-js/faker`, `socket.io`, `ts-node`                                |
| `@socketdocs/docs-server` | `packages/docs-server` | React/Vite SPA docs UI (**private**, not published)                      | —                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `react`, `react-dom`, `socket.io-client`, `lucide-react`, `clsx`, `tailwind-merge` (dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`) |

### Build setup

- **TypeScript Project References**: root `tsconfig.json` lists all 8 packages as `references`. Base config at `tsconfig.base.json` (`target: ES2020`, `module: Node16`, `moduleResolution: Node16`, `composite: true`, `declaration: true`, `strict: true`, `experimentalDecorators`, `emitDecoratorMetadata`, path alias `@socketdocs/core → packages/core/src/index.ts`).
- **Bundler**: None for the TS packages — each is compiled with `tsc -p tsconfig.json` into `dist/` (CommonJS-free ESM, `"type": "module"`). The `docs-server` is built with **Vite** (`vite build`, minify `terser`).
- **Test runner**: `@socketdocs/core` declares `vitest` as devDep and `scripts.test = "vitest run"`, but also ships a `jest.config.cjs` (ts-jest preset). The root `npm test` runs `npm test --workspaces --if-present`. The two adapter tests import from `../../ws/src/index.js` / `../../fastify/src/index.js`.
- **Root scripts** (`package.json`): `clean`, `build` (`tsc -b`), `build:docs` (cd docs-server && vite build, `|| true`), `test`, `lint` (eslint), `format` (prettier).

---

## 2. CORE DATA MODEL

All types live in `packages/core/src/contract.ts`.

### Key types

**Contract & namespace/event (fluent model):**

```ts
export type Direction =
  | 'client_to_server'
  | 'server_to_client'
  | 'bidirectional';
export type EventType = 'fire_and_forget' | 'request_response';

export interface ErrorDefinition {
  code: string | number;
  description: string;
}

export interface EventDefinition<
  P extends ZodTypeAny = any,
  R extends ZodTypeAny = any,
> {
  name: string;
  direction: Direction;
  type?: EventType;
  summary?: string;
  description?: string;
  payload?: P; // Zod
  response?: R; // Zod
  payloadSchema?: any; // raw JSON Schema (alt)
  responseSchema?: any; // raw JSON Schema (alt)
  roles?: string[];
  authRequired?: boolean;
  examples?: any[];
  errors?: ErrorDefinition[];
}

export interface NamespaceDefinition {
  name: string;
  events: Map<string, EventDefinition>;
}
```

**Security scheme:**

```ts
export interface SecurityRequirement {
  name: string;
  type: 'apiKey' | 'http' | 'oauth2';
  in?: 'header' | 'query' | 'cookie';
  description?: string;
}
```

**Contract options:**

```ts
export interface ContractOptions {
  name: string;
  version: string;
  description?: string;
  security?: SecurityRequirement[];
}
```

**`SocketDocsSchema` (the flat, build.md / socketdocs.json format):**

```ts
export interface SocketEventDoc {
  name: string;
  direction: 'emit' | 'on' | 'both'; // different vocabulary!
  namespace?: string;
  room?: string;
  description: string;
  payload: any; // JSON Schema
  acknowledgement?: any; // JSON Schema (renamed from "response")
  errors?: Array<{ code: string; message: string }>;
  example?: { emit?: unknown; receive?: unknown };
  tags?: string[];
  deprecated?: boolean;
}

export interface SocketDocsSchema {
  title: string;
  version: string;
  description?: string;
  servers: Array<{ url: string; label: string }>;
  events: SocketEventDoc[];
}
```

### How Zod / JSON Schema / fluent API normalize

1. **Fluent API** → internal representation: `createContract(options)` returns an object holding a `Map<string, NamespaceDefinition>`. `contract.namespace(ns).event(def)` stores the raw `EventDefinition` (with `payload`/`response` as **live Zod schemas**). Nothing is converted at definition time.
2. **Zod → JSON Schema conversion** happens inside `generateSpec()` (contract.ts L239-273) via `zodToJsonSchema(def.payload)` from `zod-to-json-schema`. If `payloadSchema` (raw JSON Schema) is already provided it is used directly instead.
3. **JSON Schema (raw)** is passed straight through as `payloadSchema`/`responseSchema`.
4. Validation (`createValidator` in `validation.ts`) prefers the live Zod schema (`safeParse`) if present, falling back to Ajv-compiled `payloadSchema`, and finally a pass-through `{ success: true }`.

### Two schema formats and reconciliation

Yes, there are **two distinct formats**:

- **Fluent contract** (`createContract` / `Contract`): nested `namespaces → events`, directions `client_to_server | server_to_client | bidirectional`, Zod-first, errors shaped `{ code, description }`.
- **`SocketDocsSchema` / `socketdocs.json`**: flat `events[]` array, directions `emit | on | both`, JSON-Schema-only payload, `acknowledgement` instead of `response`, errors shaped `{ code, message }`, plus `room`/`tags`/`deprecated`/`example`.

Reconciliation functions:

- `convertContractToSocketDocsSchema(contract, servers)` (contract.ts L289-337): maps direction (`client_to_server → emit`, `server_to_client → on`, `bidirectional → both`), maps errors `description → message`, namespaces → `namespace` string.
- `convertSocketDocsSchemaToContract(schema)` (contract.ts L344-381): inverse mapping, stores `payloadSchema`/`responseSchema` (Zod not reconstructed), maps `tags → roles`.

The `generateSpec()` output (used by UI / AsyncAPI / lint) is a **third** intermediate shape (`specVersion`, `info`, `security`, `namespaces.*.events.*.payloadSchema/responseSchema`) — not the same as `SocketDocsSchema`.

---

## 3. SERVER / RUNTIME

### `socketDocs()` (Express) — `packages/server/src/index.ts` L60-111

Returns an Express `Router` mounted at `options.path` (default `/socket-docs`). Routes registered:

- `GET /schema.json` → returns the resolved `SocketDocsSchema` (from `options.schema` or by converting `options.contract`).
- Static files: tries `express.static(join(__dirname, "../../docs-server/dist"))` if that path exists.
- `GET *` → SPA fallback: serves `docs-server/dist/index.html` if present, **otherwise** calls `generateHtml(spec)` (inline HTML string from `ui.ts`) as fallback.

Auth: `options.auth` is either `{username, password}` (HTTP Basic) or a custom Express middleware.

### `SocketDocsModule.setup()` (NestJS) — index.ts L116-149

Grabs the raw Express instance via `app.getHttpAdapter().getInstance()` and mounts the same `socketDocs()` router on it. Detects Contract vs Schema by duck-typing `'generateSpec' in schemaOrContract`.

### How the UI is served

Two mechanisms coexist:

1. **Preferred**: static `docs-server/dist` (Vite-built React SPA). But `@socketdocs/docs-server` is `private: true` and is **not** published to npm. The server package computes the path as `join(__dirname, "../../docs-server/dist")` — from `packages/server/dist/index.js` this resolves to `packages/docs-server/dist`. After npm publish, that relative path no longer exists, so end-users always get the fallback.
2. **Fallback**: `generateHtml(spec)` emits a single self-contained HTML string (Tailwind via CDN, highlight.js via CDN, Google Fonts). No playground — it's read-only docs.

### Adapters and event lifecycle

All adapters (`socket-io`, `ws`, `fastify`) follow the same pattern. Lifecycle for one incoming event using the Socket.IO adapter (`packages/socket-io/src/index.ts`):

1. **Binding** — `bindSocketioAdapter(io, contract, handlers, opts)` iterates `contract._namespaces`; for each namespace it resolves the Socket.IO namespace (`io.of(nsName)`) and registers a `connection` listener.
2. **Auth** — on connection, calls `opts.onAuth(socket)` (if provided). Failure → `socket.disconnect(true)`.
3. **For each `client_to_server`/`bidirectional` event** it creates `createValidator(eventDef)` (payload) and `createValidator(eventDef, 'response')`, then `socket.on(eventName, ...)`.
4. **Payload validation** — `validator.validate(payload)`; on failure → `ack({ status: "error", code: 400, message: "Invalid payload", details })` + `contract.plugins.notifyError`.
5. **Auth/roles check** — `eventDef.authRequired && !authCtx` → 401; `roles` not matched → 403. Both fire `notifyError`.
6. **Plugin hook** — `contract.plugins.notifyEvent(eventName, payload, nsName)`.
7. **Handler** — looks up `handlers[nsName][eventName]`. If absent, returns silently (user may use raw `socket.on`). Calls `handler({ payload, socket, auth: authCtx })`.
8. **Response validation** — `responseValidator.validate(result)`; failure → `ack({ status: "error", code: 500, ... })`.
9. **Success** — `notifyResponse`, then `ack(responseResult.data)`.
10. **Handler throw** → `notifyError` + `ack({ status: "error", code: 500, message: err.message })`.

`ws` and `fastify` adapters mirror this but use a JSON envelope `{ event, namespace, id, payload }` over the raw socket, and send responses as `{ type: "response", id, payload }`.

### Runtime introspection?

**No.** Nothing introspects a running server. Everything is driven by the user-supplied `Contract` (or `SocketDocsSchema`). The only "scan" is the NestJS `SocketDocsModule` (`packages/nestjs/src/index.ts` L65-97), which scans **providers/controllers decorated with SocketDocs' own `@Namespace`/`@Event` decorators** — it does **not** read `@SubscribeMessage` metadata or existing gateways.

---

## 4. DOCUMENTATION UI

### Tech stack

- **Framework**: React 18 (despite CHANGELOG claiming React 19), TypeScript, Vite 5, Tailwind CSS 3, `lucide-react` icons, `socket.io-client`.
- **Files**: `packages/docs-server/src/App.tsx` (single 576-line component), `main.tsx`, `index.css`, `index.html`.

### How it receives the spec

The SPA `fetch('./schema.json')` on mount (App.tsx L46-63) — relies on the server middleware exposing `GET /<path>/schema.json`. The spec shape expected is the **`generateSpec()`** output (`specVersion`, `info`, `namespaces`), **not** `SocketDocsSchema`.

### UI features

- **Explorer**: left sidebar with tab switch (Documentation / Playground), search box, namespace list. Main area: API title/description, per-namespace event cards showing direction badge (`client_to_server` green / `server_to_client` purple / `bidirectional` blue), type badge, AUTH badge, summary, errors list, payload/response JSON (preformatted, no syntax highlighting in the React version).
- **Playground**: connection panel (URL input, Connect/Disconnect, auth type None/Bearer/API Key + token), event selector (namespace + event, filtered to non-`server_to_client`), JSON payload textarea, Send button. Right side: event log with color-coded in/out/error/info entries, timestamps, auto-scroll, clear button.
- **Connection**: creates `io(socketUrl, { path: namespace === 'default' ? '/socket.io' : '/' + namespace, auth })`. Bearer → `auth.token = 'Bearer …'`; apiKey → `auth.apiKey = …`. Registers listeners for every spec event to log incoming. Sends via `socket.emit(selectedEvent, payload, ack)`.
- **Error display**: connection errors logged as red entries; no structured payload validation on the client side.
- **Theme toggle**: dark/light via `document.documentElement.classList.toggle('dark')` (Tailwind `dark:` classes).

### Is the UI a separate package? How shipped?

It is `@socketdocs/docs-server`, **private** (`"private": true`). It is **not** published to npm. The `@socketdocs/server` package references its `dist` via a relative path that only resolves inside the monorepo. So a published consumer of `@socketdocs/server` never gets the React SPA — only the `generateHtml()` fallback (which is read-only, no playground). The root `build:docs` script builds it but is not part of `npm run build`.

---

## 5. CLI

All commands in `packages/cli/src/index.ts`. The binary is `socketdocs` (`bin` → `dist/index.js`).

| Command             | What it does                                                                                                                                                                                                                                                                                  | How contract is loaded                                                                                               |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `init`              | Writes `socketdocs.config.json` (`{name, version, contractFile: "./socketdocs.contract.ts", outputFile: "./wsdoc.json"}`) and a sample `socketdocs.contract.ts` if absent.                                                                                                                    | n/a                                                                                                                  |
| `generate-spec`     | Reads config, loads the `.ts` contract via **jiti**, calls `contract.generateSpec()`, writes JSON to `config.outputFile`.                                                                                                                                                                     | `jiti(import.meta.url, { interopDefault: true })` then `load(contractFilePath)`; duck-types `contract.generateSpec`. |
| `serve-docs`        | Starts a plain `http` server. Serves `GET /api/spec` (the parsed spec JSON) and everything else as `generateHtml(spec)`. Auto-increments port on `EADDRINUSE`.                                                                                                                                | Reads `--spec` JSON file (default `./wsdoc.json`) — already-generated spec, **not** the `.ts` contract.              |
| `generate-sdk`      | Reads spec JSON, dispatches to `TypescriptGenerator`/`GoGenerator`/`PythonGenerator`/`PhpGenerator`, writes output file.                                                                                                                                                                      | Spec JSON file only.                                                                                                 |
| `validate-contract` | Loads the `.ts` contract via jiti, performs structural validation (namespaces Map, events Map, direction enum, errors shape, request_response needs response), calls `generateSpec()` and `lintSpec()`, prints issues, exits 1 on errors.                                                     | jiti load of `config.contractFile`.                                                                                  |
| `mock-server`       | Reads spec JSON, creates a Socket.IO server, sets up namespaces from `spec.namespaces`, listens for client_to_server/bidirectional events, validates payload with Ajv, generates mock response data via `@faker-js/faker` (`generateMockData`), emits mock server-to-client events on timers. | Spec JSON file only.                                                                                                 |
| `lint`              | Loads `.ts` contract via jiti, calls `generateSpec()`, runs `lintSpec(spec)`, prints issues.                                                                                                                                                                                                  | jiti load of `config.contractFile`.                                                                                  |
| `export-asyncapi`   | Reads spec JSON, calls `convertToAsyncApi(spec)`, writes `asyncapi.json`.                                                                                                                                                                                                                     | Spec JSON file only.                                                                                                 |

### Commands the request lists that DON'T exist

The request lists `validate`, `serve`, `build`. The **CHANGELOG** (`CHANGELOG.md` L14-17) claims `serve` (alias for serve-docs), `build` (static HTML), and `validate` (validate `socketdocs.json`) were added in 0.4.0 — **but none of these three commands exist in the CLI source**. Only the 8 commands above are registered.

### Overlap/duplication

- `validate-contract` and `lint` both load the contract, call `generateSpec()`, and run `lintSpec()`. `validate-contract` adds structural checks before linting; `lint` is a strict subset.
- `serve-docs` and `mock-server` both spin up HTTP servers; `serve-docs` is read-only docs, `mock-server` is a live Socket.IO mock.
- `generate-spec` is a prerequisite for `serve-docs`, `generate-sdk`, `mock-server`, `export-asyncapi` (all consume the JSON spec rather than the `.ts` contract directly).

---

## 6. OTHER FEATURES

### Plugin system — `packages/core/src/plugins.ts`

`SocketDocsPlugin` interface with optional hooks:

```ts
onSetup?: (contract) => void
onEvent?: (eventName, payload, namespace) => void
onResponse?: (eventName, response, namespace) => void
onError?: (eventName, error, namespace) => void
onSpecGenerated?: (spec) => void
```

`PluginManager` (instantiated inside `createContract`) registers plugins and broadcasts synchronously. Registered via `contract.registerPlugin(plugin)`. Hooks are fire-and-forget — no return-value mutation, no `onEvent` cannot short-circuit the handler. `notifySpecGenerated` exists but is **never called** anywhere in the codebase (search confirms only `notifyEvent`/`notifyResponse`/`notifyError` are used in adapters).

**Assessment: partial.** Hooks exist and are wired into the three adapters, but `onSpecGenerated` is dead, plugins can't mutate/block, and there are no bundled plugins.

### SDK generators — `packages/cli/src/generators/`

Interface `SdkGenerator { generate(spec): string; getFileExtension(): string }`. Implementations are hand-rolled string concatenation (no template engine):

- `TypescriptGenerator` (covers `ts` and `js`): emits a `SocketDocsClient` class with one method per client-sendable event; request-response wraps `socket.emit` in a Promise. **No type definitions generated** despite `ts` target.
- `GoGenerator`: stub — `fmt.Printf` + `return nil`, no actual socket emit.
- `PythonGenerator`: calls `self.socket.emit(eventName, payload)` — assumes a socket.io-client-like API.
- `PhpGenerator`: `$this->socket->emit(...)` — assumes a PHP socket.io client.

**Assessment: stub/partial.** TS is usable as a thin wrapper; Go is a no-op stub; Py/PHP assume undefined client APIs. No schema-based typing, no namespace scoping in generated methods.

### Mock server — `mock-server` CLI command

Uses Socket.IO + Ajv + faker. Generates data from JSON Schema by type (handles `string` formats `email/uri/uuid/date-time`, `enum`, `pattern`, `number/integer` min/max, `array`, `object` required+optional, `oneOf`/`anyOf`). Emits random server-to-client events on timers.

**Assessment: complete and functional** for the spec-JSON path.

### AsyncAPI export — `packages/core/src/asyncapi.ts`

`convertToAsyncApi(spec)` → AsyncAPI 3.0 doc. Maps namespaces → channels, events → `components.messages`, builds `send`/`receive` operations per channel. Security schemes mapped (apiKey/http/oauth2; oauth2 `flows` is an empty placeholder). Errors are **not** mapped. Server is hardcoded to `localhost:{port}` (ignores `spec.servers`).

**Assessment: partial.** Channels/messages/operations/security are produced; errors, tags, examples mapping, and real server URLs are missing or stubbed.

### Linting — `packages/core/src/lint.ts`

`lintSpec(spec)` returns `LintIssue[]` (`{ type: 'error'|'warning', message, path }`). Rules: missing description, namespace kebab-case, duplicate event names, event snake_case, missing summary+description, missing payload schema (unless server_to_client), request_response missing response schema, authRequired without global security, invalid roles, non-object examples, missing/duplicate error codes, missing error description, empty namespaces, no namespaces.

**Assessment: complete** as a style/sanity linter.

---

## 7. QUALITY ASSESSMENT

### What works well / worth keeping

- The **fluent contract builder** (`createContract` / `.namespace().event().errors()`) is clean and the Zod-first approach gives both runtime validation and JSON Schema generation in one place.
- **`generateSpec()`** centralizes Zod→JSON Schema conversion cleanly.
- **Three runtime adapters** share a consistent auth → validate → plugins → handler → response-validate → error lifecycle.
- **`lintSpec`** is a genuinely useful ruleset.
- **`convertContractToSocketDocsSchema` / `convertSocketDocsSchemaToContract`** give a bridge between the two schema vocabularies.
- The **`generateHtml()` fallback** means docs always render even without the React build.

### Confusing / duplicated / fragile / half-finished

- **Two-and-a-half schema models**: fluent `Contract`, flat `SocketDocsSchema`, and the `generateSpec()` output. Consumers must know which each tool expects (CLI spec-JSON tools expect the `generateSpec()` shape; `socketdocs.json` is the flat shape; the React UI fetches `generateSpec()` shape from `/schema.json` but the server's `getSchema()` returns `SocketDocsSchema` — see bug below).
- **Stale compiled files in `src/`**: `packages/ws/src/index.js`, `packages/ws/src/index.d.ts`, and the equivalent in `fastify/src/` are committed build artifacts sitting next to the `.ts` source. `tsc` will collide with these.
- **`docs-server` not shipped**: private package; server references its `dist` by relative path that breaks after npm publish. End-users never get the playground.
- **CHANGELOG vs code mismatch**: 0.4.0 claims `serve`/`build`/`validate` commands that don't exist.
- **`examples/*` workspace** glob with no `examples/` directory.
- **Dual test configs**: core has both `vitest` (in `scripts.test`) and a `jest.config.cjs`. Unclear which is canonical.
- **Duplicate lint/validate**: `validate-contract` ⊇ `lint`.
- **Plugin `onSpecGenerated`** is defined but never invoked.
- **AsyncAPI oauth2 flows** is `{}`; server URL is hardcoded.
- **SDK generators**: Go is a no-op stub; all are string-concatenation with no typing.

### Known bugs

1. **`/schema.json` returns the wrong shape for the React UI.** `socketDocs()`'s `getSchema()` returns a `SocketDocsSchema` (flat `events[]`, directions `emit/on/both`), but the React `App.tsx` expects the `generateSpec()` shape (`namespaces.*.events.*`, directions `client_to_server/...`). When the SPA is served, `fetch('./schema.json')` returns data the UI can't render (`spec.namespaces` is `undefined`). The fallback `generateHtml()` path converts to the right shape internally, so only the React SPA path is broken.
2. **`docs-server` `socketUrl` defaults to `http://localhost:3000`** regardless of where docs are hosted; no inference from `window.location`.
3. **`contract.ts` `registerNamespaceClass`** (L220-232) drops payload/response schemas — it only copies `name` and `direction`, so decorator-defined events have no validation.
4. **`createValidator` uses `eventDef.payload`/`eventDef.response`** (the Zod fields) but `convertSocketDocsSchemaToContract` stores JSON schemas in `payloadSchema`/`responseSchema`. Validator handles this via the rawSchema branch, but `ws` adapter's response validation at `index.ts` L95-101 directly calls `eventDef.response.safeParse` which throws if `response` is undefined (only `responseSchema` set) — not guarded.
5. **Socket.IO adapter `bindSocketioAdapter`** iterates namespaces once at bind time; events added to the contract after binding are not picked up.
6. **`lintSpec` errors field type** in `wsdoc.schema.json` is `object` (`additionalProperties: string`), but the code uses an **array** of `{code, description}`. The JSON Schema and runtime disagree.

### Missing / failing tests

- Only 3 test files: `contract.test.ts` (10 tests, covers create/generateSpec/errors/security/auth/examples), `ws-adapter.test.ts` (1 test — just checks `bindWsAdapter` returns a `send` function), `fastify-adapter.test.ts` (1 test — checks the function is defined).
- No tests for: socket-io adapter, server middleware, NestJS module, CLI commands, SDK generators, mock server, AsyncAPI conversion, lint rules, schema conversion functions, `generateHtml`.
- Adapter tests import from `../../ws/src/index.js` / `../../fastify/src/index.js` — they exercise the stale `.js` files, not the `.ts`.

---

## 8. DIRECT ANSWERS

### Can it auto-discover events from a running Socket.IO server or NestJS gateways without a hand-written contract?

**No.** There is no runtime introspection of an existing Socket.IO server's registered event names, and no scanning of NestJS `@WebSocketGateway`/`@SubscribeMessage` metadata.

- The closest extension point is the **NestJS `SocketDocsModule`** (`packages/nestjs/src/index.ts`), which uses `DiscoveryService` + `MetadataScanner` to scan providers. However, it only picks up classes/methods decorated with SocketDocs' **own** `@Namespace`/`@Event` decorators (and `@Event` wraps `@SubscribeMessage`). To auto-discover existing NestJS gateways, you would extend `scanAndRegister()` to read `SubscribeMessage` metadata keys (`MESSAGE_MAPPING_METADATA` / `GATEWAY_METADATA`) and extract the event name, then infer direction as `client_to_server`.
- For Socket.IO, there is no equivalent. An extension point would be a new function that reads `io._events` / namespace `eventNames()` and the handler's arity to infer ack/response, but no such function exists.

### Which parts could be deleted without losing core value?

- **`@socketdocs/docs-server`** as a published concept — it's private and never shipped; either fully integrate its build into `@socketdocs/server`'s `files`, or delete it and rely on `generateHtml()`. Keeping it in its current state is dead weight.
- **`validate-contract`** (or merge into `lint`) — it is a superset of `lint` with structural checks; collapse into one command.
- **Stale `index.js`/`index.d.ts` in `ws/src` and `fastify/src`** — committed build artifacts; delete.
- **`contract.ts::registerNamespaceClass`** and the core `decorators.ts` — the core decorator path is broken (drops schemas) and redundant with the NestJS adapter's decorators.
- **`PluginManager.notifySpecGenerated` / `SocketDocsPlugin.onSpecGenerated`** — dead code (never called).
- **`GoGenerator`** — it's a no-op stub (`fmt.Printf` + `return nil`); either implement or remove.
- **The root `contract.ts` and `socketdocs.json`** are sample/demo files at the repo root, not part of any package — harmless but could move to an `examples/` directory (which the workspace glob already expects).

---

**Summary for the architect:** SocketDocs is a contract-first WebSocket doc framework with a solid core (fluent contract builder + Zod + adapters) but is held back by three diverging schema representations, a docs UI that isn't actually shipped to npm consumers, a CLI whose CHANGELOG overstates implemented commands, and thin test coverage. The path to "mount on any server and get Swagger-style docs automatically" requires (a) unifying the schema models so the served `/schema.json` matches what the React UI consumes, (b) bundling the docs-server build into the published server package, and (c) adding a real introspection layer for Socket.IO/NestJS if auto-discovery is a goal.
