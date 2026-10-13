import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { SocketDocsModule } from '@socketdocs/nestjs';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Socket.IO adapter: SocketDocs sniffs the Socket.IO server/namespace that
  // each gateway exposes through @WebSocketServer().
  app.useWebSocketAdapter(new IoAdapter(app));

  // Mount the docs before listen(): gateway events are discovered at startup,
  // i.e. BEFORE any client connects (unlike the Express sniffing path).
  SocketDocsModule.setup('/socket-docs', app, {
    title: 'Nest Chat API',
    version: '1.0.0',
    description: 'Minimal NestJS gateway example for SocketDocs',
    servers: [{ url: 'http://localhost:3001', label: 'Local' }],
  });

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.log(`Nest chat listening on http://localhost:${port}`);
  console.log(`Docs: http://localhost:${port}/socket-docs`);
}

void bootstrap();
