# @socketdocs/nestjs

The **NestJS** adapter for **SocketDocs**. Bring typed, validated, and documented WebSockets to your NestJS applications.

## 📦 Installation

```bash
npm install @socketdocs/nestjs @socketdocs/core @nestjs/websockets @nestjs/platform-socket.io zod
```

## 🚀 Getting Started

1.  **Define your contract**:

```typescript
import { createContract } from '@socketdocs/core';
import { z } from 'zod';

export const contract = createContract({ name: 'NestJS API', version: '0.2.0' });
contract.namespace('default').event({
  name: 'message',
  direction: 'client_to_server',
  payload: z.object({ text: z.string() })
});
```

2.  **Attach the adapter in your main file**:

```typescript
import { NestFactory } from '@nestjs/core';
import { bindNestjsAdapter } from '@socketdocs/nestjs';
import { contract } from './contract';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Handlers for the events defined in the contract
  const handlers = {
    'default': {
      'message': async ({ payload, client }: any) => {
        console.log(`NestJS received: ${payload.text}`);
      }
    }
  };

  bindNestjsAdapter(app, contract, handlers);

  await app.listen(3000);
}
bootstrap();
```

## 🛠️ Features

- **NestJS Architecture Support**: Integrates with NestJS's dependency injection and gateway system.
- **Validation**: Automatic validation of incoming payloads using Zod before they reach your logic.
- **Unified Handlers**: Use the `handlers` map to keep your WebSocket logic clean and documented.
- **Dependency Injection**: Seamlessly work alongside your existing NestJS providers and services.

## ⚖️ License

MIT
