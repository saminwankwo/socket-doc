# SocketDocs

**SocketDocs** is an open‑source framework for documenting WebSocket APIs.

It provides a **contract-first specification** similar to OpenAPI but designed for realtime systems.

## Vision

Make WebSocket APIs **discoverable, type-safe, and documented** the same way REST APIs are with OpenAPI.

## Features

- Contract-first WebSocket API design
- Zod schema validation
- JSON spec generation (`wsdoc.json`)
- Framework‑agnostic adapters
- CLI documentation generator
- SDK-ready specifications

## Supported adapters

- Socket.IO
- Native ws
- Fastify WebSocket
- NestJS Gateway

## Quick Start

Install dependencies

npm install

Build

npm run build

Run example

cd examples/socket-io
npx ts-node index.ts
