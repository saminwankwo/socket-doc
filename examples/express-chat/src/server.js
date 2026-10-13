import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { SocketDocs } from '@socketdocs/express';
import { z } from 'zod';

const PORT = Number(process.env.PORT ?? 3000);
// The handshake token accepted by the auth check below. The UI's
// "Authorize" button (Bearer token mode) sends it as `auth.token`.
const VALID_TOKEN = process.env.CHAT_TOKEN ?? 'demo-token';

const app = express();
app.get('/', (_req, res) => {
  res
    .type('text/plain')
    .send(
      `Chat server is running.\nOpen http://localhost:${PORT}/socket-docs for the docs.\n`,
    );
});

const server = http.createServer(app);
const io = new Server(server);

const docs = SocketDocs.setup(app, io, {
  path: '/socket-docs',
  title: 'Chat API',
  version: '1.0.0',
  description:
    'Realtime chat demo: declared events, ack-based events and auto-discovered events.',
  servers: [{ url: `http://localhost:${PORT}`, label: 'Local' }],
  // Handshake auth, shown in the UI's Authorize modal.
  security: [
    {
      name: 'token',
      type: 'apiKey',
      in: 'auth',
      description: 'Handshake token, see README',
    },
  ],
  // Store one sample payload per event from live traffic (shown as Try-it examples).
  captureExamples: true,
});

docs.namespace('/chat', 'Room-based chat');

// Fully declared event: schemas, errors and docs are all written by hand.
docs.event(
  'send_message',
  {
    summary: 'Send a message to a room',
    description:
      'Broadcasts the message to everyone in the room as a `new_message` event.',
    payload: z.object({
      text: z.string().min(1).max(500),
      roomId: z.string(),
    }),
    response: z.object({ ok: z.boolean() }),
    errors: [{ code: 'INVALID_ROOM', description: 'Room does not exist' }],
    tags: ['chat'],
  },
  { namespace: '/chat' },
);

// Ack-based event: the client passes a callback as the last argument, which
// SocketDocs records as `kind: "request_response"`.
docs.event(
  'join_room',
  {
    summary: 'Join a room (request/response)',
    description: 'Acknowledges with the room name and the number of members.',
    payload: z.object({ roomId: z.string() }),
    response: z.object({ joined: z.string(), members: z.number() }),
    kind: 'request_response',
    tags: ['chat'],
  },
  { namespace: '/chat' },
);

// ---------------------------------------------------------------------------
// Auth check: every connection must carry `auth.token` in the handshake.
// In the UI: Authorize -> Bearer token -> `demo-token`.
// ---------------------------------------------------------------------------
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (token !== VALID_TOKEN) {
    return next(
      new Error(
        'unauthorized: send { token: "demo-token" } in the handshake auth payload',
      ),
    );
  }
  next();
});

// ---------------------------------------------------------------------------
// Default namespace. `typing` is deliberately NOT declared anywhere: it shows
// up in the docs only after the first client emits it (auto-discovery).
// ---------------------------------------------------------------------------
io.on('connection', (socket) => {
  console.log(`[default] ${socket.id} connected`);

  socket.on('typing', (data) => {
    socket.broadcast.emit('typing', { userId: socket.id, ...data });
  });

  socket.on('disconnect', () => {
    console.log(`[default] ${socket.id} disconnected`);
  });
});

// ---------------------------------------------------------------------------
// /chat namespace: implements the declared events above.
// ---------------------------------------------------------------------------
const chat = io.of('/chat');

chat.on('connection', (socket) => {
  console.log(`[/chat] ${socket.id} connected`);

  socket.on('join_room', (data, ack) => {
    const roomId = typeof data?.roomId === 'string' ? data.roomId : 'lobby';
    socket.join(roomId);
    const members = chat.adapter.rooms.get(roomId)?.size ?? 1;
    // Acknowledges the client: the UI shows this response in the event card.
    ack({ joined: roomId, members });
  });

  socket.on('send_message', (data, ack) => {
    if (!data?.text || !data?.roomId) {
      if (typeof ack === 'function') ack({ ok: false });
      return;
    }
    // Server -> client event, auto-discovered by SocketDocs sniffing.
    chat.to(data.roomId).emit('new_message', {
      roomId: data.roomId,
      text: data.text,
      from: socket.id,
      at: new Date().toISOString(),
    });
    if (typeof ack === 'function') ack({ ok: true });
  });
});

server.listen(PORT, () => {
  const address = server.address();
  const actualPort =
    typeof address === 'object' && address ? address.port : PORT;
  console.log(`Chat server listening on http://localhost:${actualPort}`);
  console.log(
    `Docs: http://localhost:${actualPort}/socket-docs (Authorize with token "${VALID_TOKEN}")`,
  );
});
