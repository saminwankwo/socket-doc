# SocketDocs examples

Runnable apps that use the workspace packages. Build the repo once first (`npm install && npm run build` at the root), then start one:

| Example | Stack | Demonstrates |
|---|---|---|
| [`express-chat`](express-chat) | Express + Socket.IO | Declared event, undeclared (sniffed) event, ack-based event, handshake-token auth. **The manual test bed.** |
| [`nest-chat`](nest-chat) | NestJS + Socket.IO | Gateway discovery at startup, `@SocketEvent` enrichment, server → client sniffing. |

```bash
npm run start -w socketdocs-example-express-chat   # http://localhost:3000/socket-docs
npm run start -w socketdocs-example-nest-chat      # http://localhost:3001/socket-docs
npm run check:examples                             # end-to-end smoke check of express-chat
```
