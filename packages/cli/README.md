# @socketdocs/cli

The command-line interface for **SocketDocs**. Use it to initialize, generate, and visualize your WebSocket API documentation.

## 📦 Installation

```bash
# Global installation (recommended for CLI use)
npm install -g @socketdocs/cli

# Local installation as devDependency
npm install -D @socketdocs/cli
```

## 🚀 Getting Started

Initialize SocketDocs in your project:

```bash
socketdocs init
```

This creates a `socketdocs.config.json` file where you can specify your contract entry point and other settings.

## 🛠️ Commands

### `socketdocs init`
Sets up the project configuration and a basic documentation structure.

### `socketdocs generate`
Scans your contract and generates a JSON specification file.

```bash
socketdocs generate --output ./docs/spec.json
```

### `socketdocs serve`
Launches a local development server with a UI to visualize your WebSocket API documentation in real-time.

```bash
socketdocs serve --spec ./docs/spec.json --port 4000
```

## 📄 Configuration

A typical `socketdocs.config.json`:

```json
{
  "entry": "./src/contract.ts",
  "output": "./docs/socketdocs.json",
  "title": "My Realtime API",
  "version": "1.0.0"
}
```

## ⚖️ License

MIT
