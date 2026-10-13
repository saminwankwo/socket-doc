import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, ModulesContainer } from "@nestjs/core";
import {
  GATEWAY_METADATA,
  GATEWAY_OPTIONS,
  GATEWAY_SERVER_METADATA,
  MESSAGE_MAPPING_METADATA,
  MESSAGE_METADATA,
} from "@nestjs/websockets/constants.js";
import {
  EventRegistry,
  type SecuritySpec,
  type SocketDocsSpec,
} from "@socketdocs/core";
import {
  instrumentSocketIO,
  mountDocs,
  type EventDeclaration,
  type ExpressAppLike,
  type SocketDocsInstance,
  type SocketDocsOptions,
} from "@socketdocs/express";
import { SOCKET_EVENT_METADATA, type SocketEventOptions } from "./decorators.js";

export interface SocketDocsConfig {
  title: string;
  version: string;
  description?: string;
  servers?: Array<{ url: string; label?: string }>;
  security?: SecuritySpec[];
  socketPath?: string;
  auth?: SocketDocsOptions["auth"];
  /** Auto-discover events from the reachable Socket.IO server (default: true). */
  sniff?: boolean;
}

const RESERVED_METHODS = new Set(["constructor"]);

function normalizeNamespace(raw: unknown): string {
  if (typeof raw !== "string" || raw.trim() === "") return "/";
  const withSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : withSlash;
}

function readGatewayOptions(ctor: object): Record<string, unknown> {
  try {
    const options = Reflect.getMetadata(GATEWAY_OPTIONS, ctor);
    if (options && typeof options === "object") return options as Record<string, unknown>;
    // Older NestJS versions stored the gateway options on GATEWAY_METADATA itself.
    const legacy = Reflect.getMetadata(GATEWAY_METADATA, ctor);
    if (legacy && typeof legacy === "object") return legacy as Record<string, unknown>;
  } catch {
    // ignore malformed metadata
  }
  return {};
}

function isGateway(ctor: object): boolean {
  try {
    return Reflect.getMetadata(GATEWAY_METADATA, ctor) !== undefined;
  } catch {
    return false;
  }
}

/**
 * Reads the event name of a `@SubscribeMessage` handler.
 * Recent NestJS versions store `true` in MESSAGE_MAPPING_METADATA and the
 * pattern in MESSAGE_METADATA; older versions store the pattern directly.
 * Returns `undefined` when the name cannot be determined (we do not guess).
 */
function readEventName(method: object): string | undefined {
  try {
    const message = Reflect.getMetadata(MESSAGE_METADATA, method);
    if (typeof message === "string" || typeof message === "number" || typeof message === "symbol") {
      return String(message);
    }
    const mapping = Reflect.getMetadata(MESSAGE_MAPPING_METADATA, method);
    if (typeof mapping === "string" || typeof mapping === "number" || typeof mapping === "symbol") {
      return String(mapping);
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function hasMessageMapping(method: object): boolean {
  try {
    return Reflect.getMetadata(MESSAGE_MAPPING_METADATA, method) !== undefined;
  } catch {
    return false;
  }
}

function isSocketIOServer(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const candidate = value as any;
  if (typeof candidate.on !== "function" || typeof candidate.emit !== "function") return false;
  // Socket.IO Server
  if (typeof candidate.of === "function") return true;
  // Socket.IO Namespace (e.g. what a gateway exposes for a custom namespace)
  return typeof candidate.name === "string";
}

/**
 * Finds the Socket.IO server/namespace a gateway was given via `@WebSocketServer()`.
 */
function findGatewaySocketServer(instance: any): any | undefined {
  try {
    for (const propertyKey in instance) {
      if (typeof instance[propertyKey] === "function") continue;
      if (Reflect.getMetadata(GATEWAY_SERVER_METADATA, instance, propertyKey)) {
        const value = instance[propertyKey];
        if (isSocketIOServer(value)) return value;
      }
    }
    if (isSocketIOServer(instance.server)) return instance.server;
  } catch {
    // never throw into user code
  }
  return undefined;
}

function isExpressApp(instance: any): boolean {
  if (!instance || typeof instance.use !== "function") return false;
  // Express apps expose `handle`; Fastify instances do not (they have `inject`/`route`).
  return typeof instance.handle === "function";
}

/** Collects instance wrappers from DiscoveryService, falling back to the ModulesContainer. */
function collectWrappers(app: INestApplication): any[] {
  try {
    const discovery = (app as any).get(DiscoveryService, { strict: false });
    if (discovery && typeof discovery.getProviders === "function") {
      return [...discovery.getProviders(), ...discovery.getControllers()];
    }
  } catch {
    // DiscoveryModule not imported; fall back below
  }

  try {
    const modules = (app as any).get(ModulesContainer, { strict: false });
    if (modules && typeof modules.values === "function") {
      const wrappers: any[] = [];
      for (const mod of modules.values()) {
        if (mod?.providers) wrappers.push(...mod.providers.values());
        if (mod?.controllers) wrappers.push(...mod.controllers.values());
      }
      return wrappers;
    }
  } catch {
    // no container available
  }

  return [];
}

class SocketDocsNestInstanceImpl implements SocketDocsInstance {
  constructor(public registry: EventRegistry) {}

  event(name: string, def: EventDeclaration, opts?: { namespace?: string }): this {
    const ns = opts?.namespace ?? "/";
    this.registry.declare(ns, name, def as any);
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

export class SocketDocsModule {
  /**
   * Discovers existing `@WebSocketGateway` / `@SubscribeMessage` metadata and
   * mounts the SocketDocs UI plus `/spec.json` on the Express adapter.
   *
   * Events discovered from decorators appear at startup, before any client
   * connects (unlike Express, where sniffing needs a first connection).
   */
  static setup(path: string, app: INestApplication, config: SocketDocsConfig): SocketDocsInstance {
    const httpAdapter = typeof (app as any).getHttpAdapter === "function" ? app.getHttpAdapter() : undefined;
    const expressApp = httpAdapter && typeof httpAdapter.getInstance === "function" ? httpAdapter.getInstance() : undefined;

    if (!httpAdapter || !isExpressApp(expressApp)) {
      throw new Error(
        "SocketDocsModule requires an Express HTTP adapter (e.g. NestExpressApplication with @nestjs/platform-express). " +
          "Fastify and other adapters are not supported."
      );
    }

    const registry = new EventRegistry({
      info: {
        title: config.title,
        version: config.version,
        description: config.description,
      },
      servers: config.servers,
      socketPath: config.socketPath ?? "/socket.io",
      security: config.security,
    });

    // 1. Discover gateways and their message handlers
    const gateways: any[] = [];

    for (const wrapper of collectWrappers(app)) {
      const instance = wrapper?.instance;
      if (!instance || !instance.constructor || !isGateway(instance.constructor)) continue;
      gateways.push(instance);

      const namespace = normalizeNamespace(readGatewayOptions(instance.constructor).namespace);
      registry.namespace(namespace);

      const prototype = Object.getPrototypeOf(instance);
      let methodNames: string[];
      try {
        const scanner = (app as any).get(MetadataScanner, { strict: false }) as MetadataScanner | undefined;
        methodNames = scanner
          ? scanner.getAllMethodNames(prototype)
          : Object.getOwnPropertyNames(prototype);
      } catch {
        methodNames = Object.getOwnPropertyNames(prototype);
      }

      for (const methodName of methodNames) {
        if (RESERVED_METHODS.has(methodName)) continue;
        const method = instance[methodName];
        if (typeof method !== "function" || !hasMessageMapping(method)) continue;

        const eventName = readEventName(method);
        if (!eventName) continue; // cannot determine reliably; do not guess

        const socketEventMeta: SocketEventOptions | undefined = Reflect.getMetadata(
          SOCKET_EVENT_METADATA,
          method
        );

        if (socketEventMeta) {
          // Enriched with @SocketEvent: normalizeSchema runs inside declare().
          registry.declare(namespace, eventName, {
            ...socketEventMeta,
            direction: socketEventMeta.direction ?? "client_to_server",
          });
        } else {
          registry.observe(namespace, eventName, {
            direction: "client_to_server",
            source: "decorator",
          });
        }
      }
    }

    // 2. Sniff the reachable Socket.IO server (catches server -> client events).
    //    Gateways receive their server during app.init(), so retry afterwards.
    const instrumented = new WeakSet<object>();
    const attachSniffers = () => {
      if (config.sniff === false) return;
      for (const instance of gateways) {
        const server = findGatewaySocketServer(instance);
        if (!server || instrumented.has(server)) continue;
        instrumented.add(server);
        try {
          instrumentSocketIO(server, registry, { sniff: true });
        } catch {
          // sniffing must never break the app
        }
      }
    };

    attachSniffers();

    const missingServer = gateways.some((instance) => !findGatewaySocketServer(instance));
    const nestApp = app as any;
    if (missingServer && typeof nestApp.init === "function" && !nestApp.isInitialized) {
      const originalInit = nestApp.init.bind(app);
      nestApp.init = (...args: unknown[]) => {
        const result = originalInit(...args);
        return Promise.resolve(result).then((value: unknown) => {
          attachSniffers();
          return value;
        });
      };
    }

    // 3. Mount the shared docs router (301 redirect, spec.json, bundled UI, auth)
    mountDocs(expressApp as ExpressAppLike, registry, {
      path,
      auth: config.auth,
    });

    return new SocketDocsNestInstanceImpl(registry);
  }
}

export * from "./decorators.js";
export type { SocketDocsInstance, EventDeclaration } from "@socketdocs/express";
