# SocketDocs

OpenAPI-style documentation and validation framework for WebSocket APIs.

SocketDocs allows you to define a single source of truth for your WebSocket events and use it to validate payloads, generate documentation, and create client SDKs.

## Features

- **Contract-First Design**: Define your API once, use it everywhere.
- **Framework Agnostic**: Adapters for Socket.IO, standard WebSockets, Fastify, and NestJS.
- **Unified Validation**: Built-in support for Zod and JSON Schema (AJV).
- **Interactive Documentation**: Swagger-like UI with a built-in playground to test events.
- **SDK Generation**: Generate typed clients for TypeScript, Go, and Python.

## Installation

```bash
npm install @socketdocs/core
```

## Quick Start

### 1. Define your Contract

Create a `socketdocs.contract.ts` file:

```typescript
import { createContract } from "@socketdocs/core";
import { z } from "zod";

export const contract = createContract({
  name: "Chat API",
  version: "1.0.0",
  description: "A simple realtime chat API"
});

const chat = contract.namespace("chat");

chat.event({
  name: "send_message",
  direction: "client_to_server",
  payload: z.object({
    text: z.string(),
    roomId: z.string()
  })
});
```

### 2. Bind to your Server (Socket.IO example)

```typescript
import { Server } from "socket.io";
import { bindSocketioAdapter } from "@socketdocs/socket-io";
import { contract } from "./socketdocs.contract";

const io = new Server(3000);

const handlers = {
  chat: {
    send_message: async ({ payload, socket }) => {
      console.log("Received:", payload.text);
      // Broadcast to others
      socket.to(payload.roomId).emit("new_message", payload);
    }
  }
};

bindSocketioAdapter(io, contract, handlers);
```

### 3. Generate Documentation

Use the CLI to generate a spec and serve the UI:

```bash
# Initialize config
npx socketdocs init

# Generate JSON spec
npx socketdocs generate-spec

# Serve documentation UI
npx socketdocs serve-docs -p 4000
```

## Testing

To run the framework tests:

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Documentation UI

The documentation server provides a modern web interface to explore your API:
- **Explorer**: View all namespaces and events with their schemas.
- **Playground**: Connect to your running server and test events interactively.

## SDK Generation

Generate client SDKs with a single command:

```bash
# TypeScript
npx socketdocs generate-sdk --lang ts -o ./sdk/client.ts

# Go
npx socketdocs generate-sdk --lang go -o ./sdk/client.go

# Python
npx socketdocs generate-sdk --lang py -o ./sdk/client.py
```

## License

MIT © [Nwankwo Samuel](https://github.com/saminwankwo)
