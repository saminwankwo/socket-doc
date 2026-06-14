# @socketdocs/server

SocketDocs server integration: Express middleware and NestJS module for serving UI and schema.

## Installation

```bash
npm install @socketdocs/server
# or
yarn add @socketdocs/server
# or
pnpm add @socketdocs/server
```

## Usage

### Express Middleware

```typescript
import express from 'express';
import { socketDocs } from '@socketdocs/server';
import { myContract } from './my-contract';

const app = express();

// Serve SocketDocs UI at /socket-docs
app.use('/socket-docs', socketDocs({
  contract: myContract,
  title: 'My API Docs',
  customCss: 'h1 { color: #10b981; }'
}));

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
```

### NestJS Module

```typescript
import { Module } from '@nestjs/common';
import { SocketDocsModule } from '@socketdocs/server';
import { myContract } from './my-contract';

@Module({
  imports: [],
})
export class AppModule {
  configure(consumer: import('@nestjs/common').MiddlewareConsumer) {
    SocketDocsModule.setup('/socket-docs', app, myContract, {
      title: 'My API Docs',
      customCss: 'h1 { color: #10b981; }'
    });
  }
}
```

## Options

| Option       | Type                                      | Description                                                                 |
|--------------|-------------------------------------------|-----------------------------------------------------------------------------|
| `path`       | `string`                                  | URL path to serve SocketDocs UI (default: `/socket-docs`)                   |
| `contract`   | `Contract` or `() => Contract`           | SocketDocs contract to use for documentation                                |
| `schema`     | `SocketDocsSchema` or `() => SocketDocsSchema` | Alternative to `contract`, pass raw schema                                  |
| `auth`       | `{ username: string; password: string }` or Express middleware | Basic auth credentials or custom auth middleware |
| `title`      | `string`                                  | Custom page title                                                           |
| `customCss`  | `string`                                  | Custom CSS to inject into the HTML                                          |
| `servers`    | `Array<{ url: string; label: string }>`  | List of server URLs to include in the spec (when using contract)            |

## License

MIT
