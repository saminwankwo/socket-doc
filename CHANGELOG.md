# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0-alpha.0] - 2026-10-13

### BREAKING CHANGES

Complete redesign into a **code-first, Swagger-style documentation tool for Socket.IO**. The previous contract-first multi-framework toolkit (fluent `createContract`, `SocketDocsSchema`/`socketdocs.json`, raw `ws` and Fastify adapters, SDK generators, mock server, plugin system) has been removed in favor of automatic event discovery.

### Added

- **Auto-discovery (sniffing)**: `SocketDocs.setup(app, io, opts)` automatically records Socket.IO events as clients connect, with zero configuration.
- **Declarative enrichment**: `docs.event(name, {...})` and `@SocketEvent({...})` (NestJS) add payload/response schemas, errors, and docs on top of sniffed events.
- **Single spec model**: `SocketDocsSpec` is the one canonical shape used by core, server, and UI.
- **`@socketdocs/express`**: mounts docs at a path, serves `spec.json` and the bundled React UI.
- **`@socketdocs/nestjs`**: discovers `@WebSocketGateway` / `@SubscribeMessage` handlers at startup.
- **Bundled UI**: the React SPA is built and shipped inside `@socketdocs/express` (no more missing-UI fallback for published consumers).
- **Fixed playground connection**: namespace goes in the URL; engine `path` is separate; default URL inferred from `window.location.origin`.

### Removed

- `@socketdocs/ws`, `@socketdocs/fastify`, `@socketdocs/socket-io` (validating adapters).
- `@socketdocs/cli` (replaced by an optional minimal CLI in a later release).
- Fluent contract API (`createContract`), `SocketDocsSchema`, `socketdocs.json`, `generateHtml()`.
- SDK generators, mock server, plugin system.
- Jest (vitest is the only test runner).
