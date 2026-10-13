import type { Express, RequestHandler } from "express";
import type { Server as SocketIOServer } from "socket.io";
import {
  EventRegistry,
  type Direction,
  type ErrorSpec,
  type EventDeclaration as CoreEventDeclaration,
  type EventKind,
  type JSONSchema,
  type SecuritySpec,
  type SocketDocsSpec,
} from "@socketdocs/core";
import type { ZodTypeAny } from "zod";
import { instrumentSocketIO } from "./instrument.js";
import { createDocsRouter, mountDocs } from "./router.js";

export interface SocketDocsOptions {
  path?: string;
  title: string;
  version: string;
  description?: string;
  servers?: Array<{ url: string; label?: string }>;
  security?: SecuritySpec[];
  socketPath?: string;
  auth?: { username: string; password: string } | RequestHandler;
  sniff?: boolean;
  captureExamples?: boolean;
}

export interface EventDeclaration {
  summary?: string;
  description?: string;
  direction?: Direction;
  /** `request_response` when the client is expected to pass an ack callback. */
  kind?: EventKind;
  payload?: ZodTypeAny | JSONSchema;
  response?: ZodTypeAny | JSONSchema;
  examples?: unknown[];
  errors?: ErrorSpec[];
  tags?: string[];
  deprecated?: boolean;
  authRequired?: boolean;
}

export interface SocketDocsInstance {
  event(name: string, def: EventDeclaration, opts?: { namespace?: string }): this;
  namespace(name: string, description?: string): this;
  registry: EventRegistry;
  spec(): SocketDocsSpec;
}

class SocketDocsInstanceImpl implements SocketDocsInstance {
  constructor(public registry: EventRegistry) {}

  event(name: string, def: EventDeclaration, opts?: { namespace?: string }): this {
    const ns = opts?.namespace ?? "/";
    this.registry.declare(ns, name, def as CoreEventDeclaration);
    return this;
  }

  namespace(name: string, description?: string): this {
    this.registry.namespace(name, description);
    return this;
  }

  spec(): SocketDocsSpec {
    return this.registry.toSpec();
  }
}

export class SocketDocs {
  static setup(app: Express, io: SocketIOServer, options: SocketDocsOptions): SocketDocsInstance {
    // 1. Resolve socketPath (default io.path() or /socket.io)
    let socketPath = options.socketPath;
    if (!socketPath) {
      if (typeof (io as any).path === "function") {
        socketPath = (io as any).path();
      } else {
        socketPath = "/socket.io";
      }
    }

    // 2. Create EventRegistry
    const registry = new EventRegistry({
      info: {
        title: options.title,
        version: options.version,
        description: options.description,
      },
      servers: options.servers,
      socketPath,
      security: options.security,
    });

    // 3. Instrument Socket.IO for auto-sniffing
    instrumentSocketIO(io, registry, {
      sniff: options.sniff !== false,
      captureExamples: options.captureExamples === true,
    });

    // 4. Mount redirect + router + bundled UI (shared with @socketdocs/nestjs)
    mountDocs(app, registry, {
      path: options.path,
      auth: options.auth,
    });

    return new SocketDocsInstanceImpl(registry);
  }
}

export { createDocsRouter, mountDocs, instrumentSocketIO };
export type { SnifferOptions } from "./instrument.js";
export type { DocsRouterOptions, MountDocsOptions, ExpressAppLike } from "./router.js";

