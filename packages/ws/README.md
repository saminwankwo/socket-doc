# @socketdocs/ws

The **ws** library adapter for **SocketDocs**. Bring contract-driven validation and documentation to your raw WebSocket servers.

## 📦 Installation

```bash
npm install @socketdocs/ws @socketdocs/core ws zod
```

## 🚀 Getting Started

1.  **Define your contract**:

```typescript
import { createContract } from '@socketdocs/core';
import { z } from 'zod';

const contract = createContract({ name: 'Raw WS API', version: '1.0.0' });
contract.namespace('default').event({
  name: 'ping',
  direction: 'client_to_server',
  payload: z.object({ id: z.string() })
});
```

2.  **Attach the adapter to your WebSocket server**:

```typescript
import { WebSocketServer } from 'ws';
import { bindWSAdapter } from '@socketdocs/ws';

const wss = new WebSocketServer({ port: 3000 });

// 2. Serve Interactive Documentation UI (Optional)
import { handleWsDocs } from '@socketdocs/ws';
import { createServer } from 'http';

const server = createServer((req, res) => {
  if (handleWsDocs(req, res, contract, '/docs')) return;
  // ... handle other routes
});

// 3. Handlers for the events defined in the contract
const handlers = {
  'default': {
    'ping': async ({ payload, socket }: any) => {
      console.log(`Ping received: ${payload.id}`);
      socket.send(JSON.stringify({ event: 'pong', payload: { id: payload.id } }));
    }
  }
};

bindWSAdapter(wss, contract, handlers);
```

## 🛠️ Features

- **JSON Protocol Support**: Automatically parses incoming messages and serializes outgoing ones, following a consistent `{ event: string, payload: any }` structure.
- **Auto-Mountable Docs**: Easily serve documentation UI from your existing HTTP server.
- **Validation**: Every incoming message is validated against its Zod schema. Invalid messages are ignored or generate errors.
- **Clean Event Handling**: Organize your WebSocket logic with a simple handler mapping.
- **Schema-First**: Leverage your existing `Contract` to ensure your raw WebSocket server stays in sync with its documentation.

## ⚖️ License

MIT
