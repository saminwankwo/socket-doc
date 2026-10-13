import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { SocketDocs } from '../src/index.js';
import { z } from 'zod';

describe('@socketdocs/express', () => {
  let app: express.Express;
  let server: http.Server;
  let io: SocketIOServer;
  let port: number;
  let baseUrl: string;

  beforeAll(async () => {
    app = express();
    server = http.createServer(app);
    io = new SocketIOServer(server);

    const docs = SocketDocs.setup(app, io, {
      path: '/socket-docs',
      title: 'Test API',
      version: '1.0.0',
      description: 'Test description',
      servers: [{ url: 'http://localhost:3000', label: 'Local' }],
    });

    // Enriched event
    docs.event('custom_event', {
      summary: 'A custom declared event',
      payload: z.object({ text: z.string() }),
      response: z.object({ ok: z.boolean() }),
    });

    // Socket.io handlers
    io.on('connection', (socket) => {
      socket.on('ping', (data, ack) => {
        if (typeof ack === 'function') {
          ack({ pong: true });
        }
      });

      socket.on('untyped_event', (_data) => {
        // fire and forget
      });
    });

    // Custom namespace
    const chatNsp = io.of('/chat');
    chatNsp.on('connection', (socket) => {
      socket.on('chat_message', (msg) => {
        socket.emit('chat_broadcast', msg);
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        const addr = server.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  afterAll(async () => {
    io.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('redirects GET /socket-docs to /socket-docs/ with 301', async () => {
    const res = await fetch(`${baseUrl}/socket-docs`, { redirect: 'manual' });
    expect(res.status).toBe(301);
    expect(res.headers.get('location')).toBe('/socket-docs/');
  });

  it('serves the UI at the trailing-slash path without redirecting forever', async () => {
    const res = await fetch(`${baseUrl}/socket-docs/`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('serves GET /socket-docs/spec.json with valid SocketDocsSpec', async () => {
    const res = await fetch(`${baseUrl}/socket-docs/spec.json`);
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.specVersion).toBe('1.0');
    expect(spec.info.title).toBe('Test API');
    expect(spec.namespaces['/'].events['custom_event']).toBeDefined();
    expect(spec.namespaces['/'].events['custom_event'].source).toBe('declared');
  });

  it('auto-sniffs incoming client event and recognizes ack callback', async () => {
    const client: ClientSocket = ioClient(baseUrl, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit('ping', { hello: 'world' }, (ackRes: any) => {
          expect(ackRes).toEqual({ pong: true });
          resolve();
        });
      });
    });

    client.disconnect();

    const res = await fetch(`${baseUrl}/socket-docs/spec.json`);
    const spec = await res.json();
    const pingSpec = spec.namespaces['/'].events['ping'];
    expect(pingSpec).toBeDefined();
    expect(pingSpec.direction).toBe('client_to_server');
    expect(pingSpec.kind).toBe('request_response');
    expect(pingSpec.source).toBe('sniffed');

    // Reserved events should not be in the spec
    expect(spec.namespaces['/'].events['connection']).toBeUndefined();
    expect(spec.namespaces['/'].events['disconnect']).toBeUndefined();
  });

  it('sniffs custom namespace events correctly', async () => {
    const client: ClientSocket = ioClient(`${baseUrl}/chat`, {
      path: '/socket.io',
      transports: ['websocket'],
    });

    await new Promise<void>((resolve) => {
      client.on('connect', () => {
        client.emit('chat_message', { text: 'hi' });
        setTimeout(resolve, 50);
      });
    });

    client.disconnect();

    const res = await fetch(`${baseUrl}/socket-docs/spec.json`);
    const spec = await res.json();
    expect(spec.namespaces['/chat']).toBeDefined();
    expect(spec.namespaces['/chat'].events['chat_message']).toBeDefined();
  });

  it('enforcing basic auth protects spec.json and html routes', async () => {
    const authApp = express();
    const authServer = http.createServer(authApp);
    const authIo = new SocketIOServer(authServer);

    SocketDocs.setup(authApp, authIo, {
      path: '/docs',
      title: 'Protected API',
      version: '1.0',
      auth: { username: 'admin', password: 'secret' },
    });

    await new Promise<void>((resolve) => {
      authServer.listen(0, () => resolve());
    });

    const authPort = (authServer.address() as any).port;
    const authBase = `http://127.0.0.1:${authPort}`;

    try {
      const unauthorizedRes = await fetch(`${authBase}/docs/spec.json`);
      expect(unauthorizedRes.status).toBe(401);

      const authorizedRes = await fetch(`${authBase}/docs/spec.json`, {
        headers: {
          Authorization:
            'Basic ' + Buffer.from('admin:secret').toString('base64'),
        },
      });
      expect(authorizedRes.status).toBe(200);
      const spec = await authorizedRes.json();
      expect(spec.info.title).toBe('Protected API');
    } finally {
      authIo.close();
      await new Promise<void>((resolve) => authServer.close(() => resolve()));
    }
  });
});
