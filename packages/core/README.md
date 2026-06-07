# @socketdocs/core

The core engine for **SocketDocs**, an OpenAPI-style documentation and validation framework for WebSocket APIs.

## 🚀 Overview

SocketDocs brings order to the wild west of WebSocket APIs. It allows you to define a single, typed **Contract** for your events using [Zod](https://zod.dev), which then powers:
- **Automatic Validation**: Incoming and outgoing payloads are automatically checked against your schemas.
- **Auto-Generated Documentation**: Export your contract to a JSON specification that can be rendered in a UI.
- **Consistency**: One source of truth for both your server-side logic and your API documentation.

## 📦 Installation

```bash
npm install @socketdocs/core zod
```

## 🛠️ Key Concepts

### **The Contract**
The `Contract` is the heart of your API. It holds the metadata (name, version, description) and all the event definitions.

```typescript
import { createContract } from '@socketdocs/core';

const contract = createContract({
  name: 'Realtime Chat',
  version: '1.2.0',
  description: 'A professional chat API with room support.',
});
```

### **Namespaces**
Just like Socket.IO, SocketDocs supports namespaces. If you don't need multiple namespaces, use the `default` one.

```typescript
const chatNamespace = contract.namespace('chat');
const adminNamespace = contract.namespace('admin');
```

### **Events**
Events are defined with a name, a direction, and a payload schema. You can also chain `.errors()` to document possible error responses.

```typescript
import { z } from 'zod';

chatNamespace.event({
  name: 'message',
  direction: 'bidirectional', // 'client_to_server', 'server_to_client', or 'bidirectional'
  summary: 'Send/Receive messages',
  description: 'Used to broadcast chat messages to everyone in the room.',
  payload: z.object({
    user: z.string().min(3).max(20),
    text: z.string().nonempty(),
    timestamp: z.number().default(() => Date.now()),
  }),
}).errors([
  { code: 'AUTH_FAILED', description: 'User not logged in' },
  { code: 'RATE_LIMITED', description: 'Too many messages' }
]);
```

### **Security**
Document authentication requirements for your initial connection.

```typescript
const contract = createContract({
  name: 'Secure API',
  version: '1.0.0',
  security: [
    {
      name: 'AuthToken',
      type: 'apiKey',
      in: 'header',
      description: 'JWT token required for connection'
    }
  ]
});
```

## 📜 Generating Specifications

You can export your entire contract as a JSON object, which follows the SocketDocs specification format.

```typescript
const spec = contract.generateSpec();
console.log(JSON.stringify(spec, null, 2));
```

## 🧩 Plugin System

SocketDocs is extensible. You can register plugins to hook into the event lifecycle (e.g., for logging, metrics, or custom transformations).

```typescript
contract.registerPlugin({
  onEvent(name, payload, namespace) {
    console.log(`[SocketDocs] Event "${name}" in "${namespace}" triggered.`);
  }
});
```

## ⚖️ License

MIT
