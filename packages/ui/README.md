# @socketdocs/ui

The React single-page app behind the SocketDocs docs page: an event explorer with a Swagger-style **Try it out** playground, an **Authorize** modal for Socket.IO handshake auth and a live event log.

This package is **private and not published separately** — its build output is copied into `@socketdocs/express` (`ui-dist/`) at build time and served from there. Use it directly only if you want to customize the look and feel.

## Development

```bash
npm run dev      # vite dev server
npm run build    # production build (packages/ui/dist)
npm run test     # vitest
```

From the repository root, `npm run build` builds this package and then runs `copy:ui` in `packages/express`.

## What it does

- **Data**: fetches `./spec.json` (relative to the mount path) and renders the `SocketDocsSpec` shape from `@socketdocs/core` (types only — no runtime dependency).
- **Connection**: connects with `io(window.location.origin + namespace, { path: spec.socketPath, auth })` — namespaces go in the URL, the engine `path` is separate. The server URL defaults to the page origin and can be overridden.
- **Sidebar**: namespace/event tree with search over name, summary and tags, plus a refresh button and an empty state.
- **Event cards**: summary, payload/response schemas, examples, errors and an inline Try it out (JSON editor prefilled from `examples[0]` or generated from the schema, ack display with a 10 s timeout).
- **Authorize**: None / Bearer token / API key / Custom handshake JSON + optional query params, persisted in `sessionStorage`; reconnects on change.
- **Listen toggle** for `server_to_client` / `bidirectional` events.
- **Event log**: timestamped, color-coded in/out/error/info entries with payload, clear, auto-scroll and event-name filter.
- Dark/light theme.

## Structure

```
src/
  App.tsx              layout + top-level state
  components/          Sidebar, ConnectionBar, EventCard, TryItOut, AuthorizeModal, EventLog, SchemaView
  hooks/useSocketClient.ts
  utils/               sampleFromSchema() and helpers
```

## License

MIT © Nwankwo Samuel
