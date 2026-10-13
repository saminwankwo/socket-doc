# socketdocs-example-express-chat

A small Express + Socket.IO chat server used as the manual test bed for
[`@socketdocs/express`](../../packages/express). It demonstrates:

- **Auto-discovery**: the `typing` event is never declared — it appears in the docs after the first client emits it.
- **Declared events**: `send_message` on `/chat` is fully documented with Zod schemas, errors and tags.
- **Ack-based events**: `join_room` on `/chat` responds through a callback (`kind: "request_response"`).
- **Handshake auth**: every connection must send `{ token: "demo-token" }` in the Socket.IO `auth` payload.
- **Server → client discovery**: `new_message` is emitted by the server and shows up as `server_to_client`.

## Run it

From the repository root (the workspace links the local packages, so build once first):

```bash
npm install
npm run build          # builds the packages + the UI bundle
npm run start -w socketdocs-example-express-chat
```

Then open <http://localhost:3000/socket-docs>.

> Undeclared events only appear after the first client connects, because Socket.IO
> handlers are registered inside the `connection` callback. Opening the docs page
> counts as that first connection once you press **Connect**.

## What to click in the UI

1. **Authorize** (top bar) → pick **Bearer token** → enter `demo-token` → **Apply**. The docs page reconnects with `auth: { token: "demo-token" }`.
   - Try it with a wrong token: the connection is rejected with `unauthorized: ...`.
2. In the **Connection bar**, keep the server URL at `http://localhost:3000` (it defaults to the page origin) and press **Connect**.
3. Expand **`typing`** (default namespace) — it is tagged *auto-discovered* and has no schema yet. Press **Try it out**, send `{}` and see the `typing` entry appear in the event log.
4. Switch to the **`/chat`** namespace, expand **`join_room`** and press **Try it out → Execute** with `{ "roomId": "general" }` — the ack response (`{ joined, members }`) is shown in the card.
5. Expand **`send_message`**, execute `{ "text": "hello", "roomId": "general" }`, then watch **`new_message`** (server → client) show up in the event log. Turn its **Listen** toggle on to receive server-pushed events.
6. Press **Refresh** in the sidebar to re-fetch `spec.json` and see the events that were discovered so far.

## Ports and tokens

```bash
PORT=4000 CHAT_TOKEN=my-secret npm run start -w socketdocs-example-express-chat
```
