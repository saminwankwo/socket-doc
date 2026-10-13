import 'reflect-metadata';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import { DiscoveryModule } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { z } from 'zod';
import {
  SocketDocsModule,
  SocketEvent,
  type SocketDocsInstance,
} from '../src/index.js';

@WebSocketGateway({ namespace: '/chat' })
class ChatGateway {
  // Exposes the Socket.IO server/namespace so SocketDocs can sniff
  // server -> client events emitted by this gateway.
  @WebSocketServer()
  server: any;

  @SubscribeMessage('send_msg')
  @SocketEvent({
    summary: 'Send a chat message',
    payload: z.object({ text: z.string() }),
    response: z.object({ delivered: z.boolean() }),
    errors: [{ code: 'INVALID_MSG', description: 'Empty message' }],
    tags: ['chat'],
  })
  handleSend(@MessageBody() _data: unknown) {
    return { delivered: true };
  }

  @SubscribeMessage('raw_event')
  handleRaw() {
    return 'ok';
  }

  handleConnection(client: any) {
    // server -> client event, only discoverable by sniffing
    client.emit('welcome', { ok: true });
  }
}

let app: INestApplication;
let moduleRef: TestingModule;
let docs: SocketDocsInstance;
let base: string;
let preInitSpec: ReturnType<SocketDocsInstance['spec']>;

async function waitFor<T>(
  fn: () => T | undefined,
  timeoutMs = 5000,
): Promise<T> {
  const start = Date.now();
  for (;;) {
    const value = fn();
    if (value !== undefined) return value;
    if (Date.now() - start > timeoutMs)
      throw new Error('timed out waiting for condition');
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

beforeAll(async () => {
  moduleRef = await Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [ChatGateway],
  }).compile();

  app = moduleRef.createNestApplication();
  app.useWebSocketAdapter(new IoAdapter(app as any));

  const config = {
    title: 'Nest Chat API',
    version: '1.0.0',
    description: 'NestJS WebSocket API',
    security: [{ name: 'token', type: 'apiKey' as const, in: 'auth' as const }],
  };

  // Typical usage: setup() runs before app.init()
  docs = SocketDocsModule.setup('/socket-docs', app, config);
  // A second mount protected by basic auth (same shared router implementation)
  SocketDocsModule.setup('/secure-docs', app, {
    ...config,
    auth: { username: 'admin', password: 'secret' },
  });

  // Gateway events must be known before init and before any client connects
  preInitSpec = docs.spec();

  await app.init();
  await app.listen(0);

  const address = app.getHttpServer().address();
  const port = typeof address === 'object' && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await app?.close();
  await moduleRef?.close();
});

describe('@socketdocs/nestjs', () => {
  it('discovers gateway events at startup, before any client connects', () => {
    const chat = preInitSpec.namespaces['/chat'];
    expect(chat).toBeDefined();

    // @SocketEvent enrichment wins and is normalized through declare()
    const sendMsg = chat.events['send_msg'];
    expect(sendMsg).toBeDefined();
    expect(sendMsg.source).toBe('declared');
    expect(sendMsg.summary).toBe('Send a chat message');
    expect(sendMsg.direction).toBe('client_to_server');
    expect(sendMsg.payloadSchema).toBeDefined();
    expect(sendMsg.responseSchema).toBeDefined();
    expect(sendMsg.errors).toEqual([
      { code: 'INVALID_MSG', description: 'Empty message' },
    ]);

    // Plain @SubscribeMessage: discovered, marked as decorator-sourced
    const raw = chat.events['raw_event'];
    expect(raw).toBeDefined();
    expect(raw.source).toBe('decorator');
    expect(raw.direction).toBe('client_to_server');

    // Server-pushed events are NOT known until they are actually emitted
    expect(chat.events['welcome']).toBeUndefined();
  });

  it('serves spec.json and redirects the mount path', async () => {
    const redirect = await fetch(`${base}/socket-docs`, { redirect: 'manual' });
    expect(redirect.status).toBe(301);
    expect(redirect.headers.get('location')).toBe('/socket-docs/');

    const page = await fetch(`${base}/socket-docs/`);
    expect(page.status).toBe(200);

    const res = await fetch(`${base}/socket-docs/spec.json`);
    expect(res.status).toBe(200);
    const spec = await res.json();
    expect(spec.info.title).toBe('Nest Chat API');
    expect(spec.namespaces['/chat'].events['send_msg'].summary).toBe(
      'Send a chat message',
    );
    expect(spec.security).toEqual([
      { name: 'token', type: 'apiKey', in: 'auth' },
    ]);
  });

  it('protects the docs page when auth is configured', async () => {
    const unauthorized = await fetch(`${base}/secure-docs/spec.json`);
    expect(unauthorized.status).toBe(401);

    const authorized = await fetch(`${base}/secure-docs/spec.json`, {
      headers: {
        Authorization: `Basic ${Buffer.from('admin:secret').toString('base64')}`,
      },
    });
    expect(authorized.status).toBe(200);
  });

  it('sniffs server -> client events emitted by the gateway', async () => {
    let client: ClientSocket | undefined;
    try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("timed out waiting for 'welcome'")),
          5000,
        );
        client = ioClient(`${base}/chat`, {
          reconnection: false,
          forceNew: true,
        });
        client.on('welcome', () => {
          clearTimeout(timer);
          resolve();
        });
        client.on('connect_error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });

      const event = await waitFor(
        () => docs.spec().namespaces['/chat'].events['welcome'],
      );
      expect(event.direction).toBe('server_to_client');
      expect(event.namespace).toBe('/chat');
    } finally {
      client?.disconnect();
    }
  });

  it('throws a clear error when the adapter is not Express', () => {
    const fastifyLikeApp: any = {
      getHttpAdapter: () => ({
        getInstance: () => ({ use() {}, listen() {}, route() {}, inject() {} }),
      }),
    };

    expect(() => {
      SocketDocsModule.setup('/socket-docs', fastifyLikeApp, {
        title: 'App',
        version: '1.0',
      });
    }).toThrow(/requires an Express HTTP adapter/);
  });
});
