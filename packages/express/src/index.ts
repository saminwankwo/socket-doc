import type { Express, RequestHandler } from "express";
import type { Server as SocketIOServer } from "socket.io";
import {
  EventRegistry,
  type Direction,
  type ErrorSpec,
  type EventDeclaration as CoreEventDeclaration,
  type JSONSchema,
  type SecuritySpec,
  type SocketDocsSpec,
} from "@socketdocs/core";
import type { ZodTypeAny } from "zod";
import { instrumentSocketIO } from "./instrument.js";
import { createDocsRouter } from "./router.js";

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
    const mountPath = options.path ?? "/socket-docs";
    // Normalize mount path: strip trailing slash
    const normalizedPath = mountPath.replace(/\/+$/, "") || "/socket-docs";

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

    // 4. Mount redirect without trailing slash: 301 redirect to <path>/
    app.get(normalizedPath, (req, res) => {
      const target = `${normalizedPath}/${req.url.includes("?") ? req.url.substring(req.url.indexOf("?")) : ""}`;
      res.redirect(301, target);
    });

    // 5. Mount the docs router
    const router = createDocsRouter(registry, {
      auth: options.auth,
    });

    app.use(normalizedPath, router);

    return new SocketDocsInstanceImpl(registry);
  }
}

export { createDocsRouter };
export type { SnifferOptions } from "./instrument.js";
export type { DocsRouterOptions } from "./router.js";

