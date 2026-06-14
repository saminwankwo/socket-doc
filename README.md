# SocketDocs

OpenAPI-style documentation and validation framework for WebSocket APIs.

SocketDocs allows you to define a single source of truth for your WebSocket events and use it to validate payloads, generate documentation, and create client SDKs.

## Features

- **Contract-First Design**: Define your API once, use it everywhere
- **Framework Agnostic**: Adapters for Socket.IO, standard WebSockets, Fastify, and NestJS
- **Unified Validation**: Built-in support for Zod and JSON Schema (AJV)
- **Interactive Documentation**: Swagger-like UI with a built-in playground to test events
- **Auto-Mountable Docs**: Mount documentation directly on your API server (e.g., `/docs`)
- **Plugin System**: Extensible hooks for events, responses, and errors (logging, analytics, monitoring)
- **SDK Generation**: Generate typed clients for TypeScript, Go, Python, and PHP
- **Robust Build System**: Built with TypeScript Project References for reliable monorepo development
- **Enhanced DX**: Automatic port detection, better error schema mapping, and seamless TypeScript contract loading
- **Mock Server**: Generate realistic mock WebSocket servers with fake data for testing
- **Deep Contract Validation**: Comprehensive validation of your API contracts
- **AsyncAPI 3.0 Support**: Export your contracts to AsyncAPI 3.0 specification
- **Enhanced Linting**: Catch common issues early with improved linting rules

## Installation

```bash
npm install @socketdocs/core
```

## Quick Start

### 1. Define your Contract

You can define your contract using either our fluent API or a build.md-style `socketdocs.json` file!

#### Option A: Fluent API (Recommended)
Create a `socketdocs.contract.ts` file:

```typescript
import { createContract } from "@socketdocs/core";
import { z } from "zod";

export const contract = createContract({
  name: "Chat API",
  version: "1.0.0",
  description: "A realtime chat API",
  security: [
    {
      name: "API Key",
      type: "apiKey",
      in: "header",
      description: "API key for authentication"
    }
  ]
});

const chat = contract.namespace("chat");

chat.event({
  name: "send_message",
  direction: "client_to_server",
  summary: "Send a message to a room",
  payload: z.object({
    text: z.string(),
    roomId: z.string()
  })
}).errors([
  { code: "INVALID_ROOM", description: "Room does not exist" },
  { code: "EMPTY_MESSAGE", description: "Message cannot be empty" }
]);

chat.event({
  name: "new_message",
  direction: "server_to_client",
  summary: "New message received in a room",
  payload: z.object({
    id: z.string(),
    text: z.string(),
    roomId: z.string(),
    sender: z.string()
  }),
  examples: [
    { id: "1", text: "Hello!", roomId: "general", sender: "user1" }
  ]
});
```

#### Option B: Build.md-style socketdocs.json
Create a `socketdocs.json` file:
```json
{
  "title": "Chat API",
  "version": "1.0.0",
  "description": "A realtime chat API",
  "servers": [
    { "url": "http://localhost:3000", "label": "Local Development" }
  ],
  "events": [
    {
      "name": "chat:message",
      "direction": "both",
      "namespace": "/chat",
      "description": "Send or receive a chat message in a room",
      "payload": {
        "type": "object",
        "properties": {
          "roomId": { "type": "string" },
          "content": { "type": "string" },
          "userId": { "type": "string" }
        },
        "required": ["roomId", "content", "userId"]
      },
      "errors": [
        { "code": "ROOM_NOT_FOUND", "message": "Room does not exist" },
        { "code": "MESSAGE_TOO_LONG", "message": "Message too long" }
      ],
      "tags": ["messaging"]
    }
  ]
}
```

### 2. Bind to your Server (Socket.IO example)

Or mount the docs directly on your server with our new middleware!

#### Express
```typescript
import express from "express";
import { socketDocs } from "@socketdocs/server";
import { SocketDocsSchema } from "@socketdocs/core";
// Or import your contract: import { contract } from "./socketdocs.contract";

const app = express();

// Mount documentation at /socket-docs
app.use("/socket-docs", socketDocs({ 
  schema: mySocketDocsSchema, 
  // Or use a contract: contract: myContract,
  servers: [{ url: "http://localhost:3000", label: "Local" }]
}));

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
  console.log("Docs available at http://localhost:3000/socket-docs");
});
```

#### NestJS
```typescript
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { SocketDocsModule } from "@socketdocs/server";
import { AppModule } from "./app.module";
import { mySchema } from "./socketdocs.json"; // Or your contract

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  
  // Mount documentation at /socket-docs
  SocketDocsModule.setup("/socket-docs", app, mySchema, {
    servers: [{ url: "http://localhost:3000", label: "Local" }]
  });

  await app.listen(3000);
  console.log("Docs available at http://localhost:3000/socket-docs");
}
bootstrap();
```

```typescript
import { Server } from "socket.io";
import { bindSocketioAdapter } from "@socketdocs/socket-io";
import { contract } from "./socketdocs.contract";

const io = new Server(3000);

const handlers = {
  chat: {
    send_message: async ({ payload, socket, auth }) => {
      console.log("Received:", payload.text);
      // Broadcast to others
      socket.to(payload.roomId).emit("new_message", {
        id: Date.now().toString(),
        text: payload.text,
        roomId: payload.roomId,
        sender: auth?.userId || "anonymous"
      });
    }
  }
};

bindSocketioAdapter(io, contract, handlers, {
  onAuth: async (socket) => {
    const apiKey = socket.handshake.headers["x-api-key"] as string;
    if (apiKey) {
      return { userId: "user1", roles: ["user"] };
    }
    return null;
  }
});
```

### 3. Generate Documentation

Use the CLI to generate a spec and serve the UI (we support both the old commands and new build.md-compatible commands!):

```bash
# Initialize config
npx socketdocs init

# --- Build.md-compatible commands ---
# Validate your schema
npx socketdocs validate -s socketdocs.json

# Serve documentation UI
npx socketdocs serve -s socketdocs.json -p 4000

# Build static HTML documentation
npx socketdocs build -s socketdocs.json -o docs/index.html

# --- Existing commands ---
# Generate JSON spec
npx socketdocs generate-spec

# Serve documentation UI (alias for serve)
npx socketdocs serve-docs -p 4000

# Validate your contract
npx socketdocs validate-contract

# Lint your contract
npx socketdocs lint

# Start a mock server for testing
npx socketdocs mock-server -p 5000

# Export as AsyncAPI specification
npx socketdocs export-asyncapi -o asyncapi.json
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
- **Explorer**: View all namespaces and events with their schemas
- **Playground**: Connect to your running server and test events interactively

## Contract Linting

Lint your contract to catch common issues early:

```bash
npx socketdocs lint
```

Linting checks for:
- Missing documentation
- Invalid naming conventions
- Missing payload schemas
- Missing response schemas for request-response events
- Duplicate event names
- Duplicate error codes
- Missing security requirements when auth is required

## AsyncAPI Export

Export your contract to AsyncAPI 3.0 specification:

```bash
npx socketdocs export-asyncapi -o asyncapi.json
```

This exports:
- All your namespaces and events
- Server information
- Security requirements
- Examples
- Operations for both sending and receiving messages

## SDK Generation

Generate client SDKs with a single command:

```bash
# TypeScript
npx socketdocs generate-sdk --lang ts -o ./sdk/client.ts

# Go
npx socketdocs generate-sdk --lang go -o ./sdk/client.go

# Python
npx socketdocs generate-sdk --lang py -o ./sdk/client.py

# PHP
npx socketdocs generate-sdk --lang php -o ./sdk/client.php
```

## Contributing

We love contributions! Whether it's adding a new adapter, improving the UI, or adding support for more SDK languages, your help is welcome.

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed instructions on how to get involved.

## License

MIT © [Nwankwo Samuel](https://github.com/saminwankwo)
