# @socketdocs/socket-io

The **Socket.IO** adapter for **SocketDocs**. Automatically validate and document your Socket.IO events using your contract.

## 📦 Installation

```bash
npm install @socketdocs/socket-io @socketdocs/core socket.io zod
```

## 🚀 Getting Started

1.  **Define your contract** (using `@socketdocs/core`):

```typescript
import { createContract } from '@socketdocs/core';
import { z } from 'zod';

const contract = createContract({ name: 'My API', version: '1.0.0' });
contract.namespace('default').event({
  name: 'hello',
  direction: 'client_to_server',
  payload: z.string()
});
```

2.  **Attach the adapter to your Socket.IO server**:

```typescript
import { Server } from 'socket.io';
import { bindSocketioAdapter } from '@socketdocs/socket-io';

const io = new Server(3000);

// Handlers for the events defined in the contract
const handlers = {
  'default': {
    'hello': async ({ payload, socket }: any) => {
      console.log(`Received: ${payload}`);
      return { status: 'ok' };
    }
  }
};

bindSocketioAdapter(io, contract, handlers);
```

## 🛠️ Features

- **Namespace Awareness**: Automatically maps contract namespaces to Socket.IO namespaces.
- **Validation**: Every incoming event is validated against its Zod schema. Invalid payloads are logged and optionally blocked.
- **Unified Handlers**: Use the `handlers` map for cleaner code structure, while still having access to the raw `socket` instance.
- **Emit with Validation**: The adapter provides an `emit` helper that validates outgoing payloads against the contract.

## ⚖️ License

MIT
