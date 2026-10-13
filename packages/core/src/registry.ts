import type { ZodTypeAny } from "zod";
import {
  type Direction,
  type ErrorSpec,
  type EventKind,
  type EventSource,
  type EventSpec,
  type NamespaceSpec,
  type SocketDocsSpec,
} from "./spec.js";
import { normalizeSchema, type JSONSchema } from "./normalize.js";

export interface ObserveInfo {
  direction?: Direction;
  kind?: EventKind;
  /**
   * Source to record when the event is observed for the first time.
   * Defaults to "sniffed". NestJS discovery uses "decorator".
   * It never downgrades an event that was already declared.
   */
  source?: EventSource;
}

export interface EventDeclaration {
  summary?: string;
  description?: string;
  direction?: Direction;
  kind?: EventKind;
  payload?: ZodTypeAny | JSONSchema;
  response?: ZodTypeAny | JSONSchema;
  examples?: unknown[];
  errors?: ErrorSpec[];
  tags?: string[];
  deprecated?: boolean;
  authRequired?: boolean;
}

type Listener = () => void;

const DECLARED_FIELDS: Array<keyof EventDeclaration> = [
  "summary",
  "description",
  "direction",
  "kind",
  "payload",
  "response",
  "examples",
  "errors",
  "tags",
  "deprecated",
  "authRequired",
];

interface StoredEvent {
  spec: EventSpec;
  declared: Set<string>;
}

export class EventRegistry {
  private namespaces: Map<string, NamespaceSpec> = new Map();
  private events: Map<string, Map<string, StoredEvent>> = new Map();
  private info: SocketDocsSpec["info"];
  private servers?: SocketDocsSpec["servers"];
  private socketPath?: string;
  private security?: SocketDocsSpec["security"];
  private listeners: Set<Listener> = new Set();

  constructor(opts: {
    info: SocketDocsSpec["info"];
    servers?: SocketDocsSpec["servers"];
    socketPath?: string;
    security?: SocketDocsSpec["security"];
  }) {
    this.info = opts.info;
    this.servers = opts.servers;
    this.socketPath = opts.socketPath;
    this.security = opts.security;
  }

  onChange(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        // listeners must not break the registry
      }
    }
  }

  private ensureNamespace(name: string): Map<string, StoredEvent> {
    let nsEvents = this.events.get(name);
    if (!nsEvents) {
      nsEvents = new Map();
      this.events.set(name, nsEvents);
      this.namespaces.set(name, { name, events: {} });
    }
    return nsEvents;
  }

  private getEvent(nsName: string, eventName: string): StoredEvent | undefined {
    return this.events.get(nsName)?.get(eventName);
  }

  observe(nsName: string, eventName: string, info: ObserveInfo = {}): void {
    try {
      const nsEvents = this.ensureNamespace(nsName);
      let stored = nsEvents.get(eventName);
      if (!stored) {
        stored = {
          spec: {
            name: eventName,
            namespace: nsName,
            direction: info.direction ?? "client_to_server",
            source: info.source ?? "sniffed",
          },
          declared: new Set(),
        };
        if (info.kind) stored.spec.kind = info.kind;
        nsEvents.set(eventName, stored);
      } else {
        // Upgrade sniffed events to a richer source (e.g. "decorator"), never downgrade.
        if (
          info.source &&
          info.source !== "sniffed" &&
          stored.spec.source === "sniffed"
        ) {
          stored.spec.source = info.source;
        }
        if (info.direction && !stored.declared.has("direction")) {
          if (stored.spec.direction === "server_to_client" && info.direction === "client_to_server") {
            stored.spec.direction = "bidirectional";
          } else if (
            stored.spec.direction === "client_to_server" &&
            info.direction === "server_to_client"
          ) {
            stored.spec.direction = "bidirectional";
          } else if (!stored.spec.direction) {
            stored.spec.direction = info.direction;
          }
        }
        if (info.kind && !stored.declared.has("kind")) {
          stored.spec.kind = info.kind;
        }
      }
      this.namespaces.get(nsName)!.events[eventName] = stored.spec;
      this.emit();
    } catch {
      // sniffing must never throw into user code
    }
  }

  declare(nsName: string, eventName: string, def: EventDeclaration): void {
    const nsEvents = this.ensureNamespace(nsName);
    let stored = nsEvents.get(eventName);
    if (!stored) {
      stored = {
        spec: {
          name: eventName,
          namespace: nsName,
          direction: def.direction ?? "client_to_server",
          source: "declared",
        },
        declared: new Set(),
      };
      nsEvents.set(eventName, stored);
    }

    stored.spec.source = "declared";

    for (const field of DECLARED_FIELDS) {
      const value = def[field];
      if (value === undefined) continue;
      stored.declared.add(field);

      switch (field) {
        case "payload":
          stored.spec.payloadSchema = normalizeSchema(value as ZodTypeAny | JSONSchema);
          break;
        case "response":
          stored.spec.responseSchema = normalizeSchema(value as ZodTypeAny | JSONSchema);
          break;
        default:
          (stored.spec as unknown as Record<string, unknown>)[field] = value;
      }
    }

    this.namespaces.get(nsName)!.events[eventName] = stored.spec;
    this.emit();
  }

  namespace(name: string, description?: string): void {
    const nsEvents = this.ensureNamespace(name);
    const ns = this.namespaces.get(name)!;
    if (description !== undefined) ns.description = description;
    for (const [eventName, stored] of nsEvents) {
      ns.events[eventName] = stored.spec;
    }
  }

  toSpec(): SocketDocsSpec {
    const namespaces: Record<string, NamespaceSpec> = {};
    for (const [name, ns] of this.namespaces) {
      namespaces[name] = { ...ns, events: { ...ns.events } };
    }
    const spec: SocketDocsSpec = {
      specVersion: "1.0",
      info: { ...this.info },
      namespaces,
    };
    if (this.servers) spec.servers = this.servers;
    if (this.socketPath !== undefined) spec.socketPath = this.socketPath;
    if (this.security) spec.security = this.security;
    return spec;
  }
}

export type { EventSource };
