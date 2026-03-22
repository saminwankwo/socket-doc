# @socketdocs/fastify

The **Fastify** adapter for **SocketDocs**. Seamlessly integrate WebSocket validation and documentation into your Fastify applications.

## 📦 Installation

```bash
npm install @socketdocs/fastify @socketdocs/core fastify @fastify/websocket zod
```

## 🚀 Getting Started

1.  **Define your contract**:

```typescript
import { createContract } from '@socketdocs/core';
import { z } from 'zod';

const contract = createContract({ name: 'Fastify API', version: '1.0.0' });
contract.namespace('default').event({
  name: 'greet',
  direction: 'client_to_server',
  payload: z.object({ name: z.string() })
});
```

2.  **Attach the adapter to your Fastify instance**:

```typescript
import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import { bindFastifyAdapter } from '@socketdocs/fastify';

const fastify = Fastify();
fastify.register(websocket);

// Handlers for the events defined in the contract
const handlers = {
  'default': {
    'greet': async ({ payload, connection }: any) => {
      console.log(`Hello, ${payload.name}!`);
    }
  }
};

fastify.ready((err) => {
  if (err) throw err;
  bindFastifyAdapter(fastify, contract, handlers);
});

fastify.listen({ port: 3000 });
```

## 🛠️ Features

- **Fastify Ecosystem Integration**: Works perfectly with `@fastify/websocket`.
- **Validation**: Every incoming message is validated against its Zod schema. Invalid messages are handled automatically.
- **Route-Level Documentation**: Links your Fastify routes with your WebSocket contract for unified documentation.
- **Async Handling**: Full support for async/await in your event handlers.

## ⚖️ License

MIT
