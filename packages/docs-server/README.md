# @socketdocs/docs-server

This is the documentation explorer UI for SocketDocs. It is a React-based single-page application that visualizes SocketDocs specifications and provides an interactive playground.

## Development

This package is managed as part of the SocketDocs monorepo.

```bash
# Start dev server
npm run dev

# Build for production
npm run build
```

## Features

- **Explorer**: Browse namespaces and events
- **Schema Viewer**: Visual representation of payload and response schemas
- **Playground**: Connect to live WebSocket servers and test events in real-time
- **Dark/Light Mode**: Toggle between themes
- **Search**: Search for events across namespaces

## Integration

The `@socketdocs/server` package automatically uses this UI when serving documentation. You don't need to use this package directly unless you want to customize the UI.

