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
