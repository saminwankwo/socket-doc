import type { Socket, Server as SocketIOServer, Namespace } from "socket.io";
import type { EventRegistry, ObserveInfo } from "@socketdocs/core";

export interface SnifferOptions {
  sniff?: boolean;
  captureExamples?: boolean;
}

const RESERVED_EVENTS = new Set([
  "connect",
  "connect_error",
  "disconnect",
  "disconnecting",
  "error",
  "newListener",
  "removeListener",
]);

const SENSITIVE_KEY_REGEX = /^(password|token|authorization|secret|apiKey|api_key|access_token|refresh_token)$/i;
const MAX_EXAMPLE_LENGTH = 1000;

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return undefined;
  if (value === null || value === undefined) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 5).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const res: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (SENSITIVE_KEY_REGEX.test(key)) {
        res[key] = "[REDACTED]";
      } else {
        res[key] = sanitizeValue(val, depth + 1);
      }
    }
    return res;
  }
  return undefined;
}

function truncateAndSanitize(data: unknown): unknown {
  try {
    const sanitized = sanitizeValue(data);
    const jsonStr = JSON.stringify(sanitized);
    if (jsonStr && jsonStr.length > MAX_EXAMPLE_LENGTH) {
      return { _truncated: true };
    }
    return sanitized;
  } catch {
    return undefined;
  }
}

/**
 * Access all namespaces defensively from Socket.IO Server.
 * Uses public and internal structures safely with fallbacks.
 */
function getAllNamespaces(io: SocketIOServer): Namespace[] {
  const nsps: Namespace[] = [];
  try {
    // Socket.IO >= 4.0 has io._nsps which is a Map<string, Namespace>
    const internalNsps = (io as any)._nsps;
    if (internalNsps instanceof Map) {
      for (const nsp of internalNsps.values()) {
        nsps.push(nsp);
      }
    } else if (io.sockets) {
      nsps.push(io.sockets);
    }
  } catch {
    if (io.sockets) {
      nsps.push(io.sockets);
    }
  }
  return nsps;
}

/**
 * A single Namespace (not a Server) can be instrumented too: NestJS gateways
 * expose either the root Socket.IO server or their namespace via
 * `@WebSocketServer()`.
 */
function looksLikeNamespace(value: unknown): value is Namespace {
  const candidate = value as any;
  return (
    !!candidate &&
    typeof candidate === "object" &&
    typeof candidate.of !== "function" &&
    typeof candidate.name === "string" &&
    typeof candidate.on === "function" &&
    typeof candidate.emit === "function"
  );
}

/**
 * Instruments a Socket.IO Server (or a single Namespace) to automatically sniff incoming and outgoing events.
 */
export function instrumentSocketIO(
  io: SocketIOServer,
  registry: EventRegistry,
  options: SnifferOptions = {}
): void {
  if (options.sniff === false) {
    return;
  }

  const hookedNamespaces = new WeakSet<Namespace>();

  const hookSocket = (namespaceName: string, socket: Socket) => {
    try {
      // 1. Hook incoming events: patch socket.on and socket.once
      const originalOn = socket.on.bind(socket);
      const originalOnce = socket.once.bind(socket);

      const wrapRegistration = (
        origMethod: (ev: string, fn: (...args: any[]) => void) => any
      ) => {
        return function (eventName: string, listener: (...args: any[]) => void) {
          try {
            if (!RESERVED_EVENTS.has(eventName)) {
              registry.observe(namespaceName, eventName, { direction: "client_to_server" });
            }
          } catch {
            // Never throw into user code
          }

          const wrappedListener = function (...args: any[]) {
            try {
              if (!RESERVED_EVENTS.has(eventName)) {
                const lastArg = args[args.length - 1];
                const isAck = typeof lastArg === "function";

                const info: ObserveInfo = { direction: "client_to_server" };
                if (isAck) {
                  info.kind = "request_response";
                }
                registry.observe(namespaceName, eventName, info);

                if (options.captureExamples && args.length > (isAck ? 1 : 0)) {
                  const payloadArg = args[0];
                  if (typeof payloadArg !== "function") {
                    const sample = truncateAndSanitize(payloadArg);
                    if (sample !== undefined) {
                      registry.observe(namespaceName, eventName, {
                        ...info,
                      });
                      // If spec has no examples yet, add it
                      const currentSpec = registry.toSpec();
                      const evSpec = currentSpec.namespaces[namespaceName]?.events[eventName];
                      if (evSpec && (!evSpec.examples || evSpec.examples.length === 0)) {
                        registry.declare(namespaceName, eventName, {
                          examples: [sample],
                        });
                      }
                    }
                  }
                }
              }
            } catch {
              // Never throw into user code
            }

            return listener.apply(socket, args);
          };

          return origMethod(eventName, wrappedListener);
        };
      };

      socket.on = wrapRegistration(originalOn) as any;
      socket.once = wrapRegistration(originalOnce) as any;

      // 2. Hook outgoing events (server -> client) via socket.onAnyOutgoing if supported (Socket.IO >= 4.5)
      if (typeof (socket as any).onAnyOutgoing === "function") {
        try {
          (socket as any).onAnyOutgoing((eventName: string, ...args: any[]) => {
            try {
              if (!RESERVED_EVENTS.has(eventName)) {
                registry.observe(namespaceName, eventName, { direction: "server_to_client" });

                if (options.captureExamples && args.length > 0) {
                  const payloadArg = args[0];
                  if (typeof payloadArg !== "function") {
                    const sample = truncateAndSanitize(payloadArg);
                    if (sample !== undefined) {
                      const currentSpec = registry.toSpec();
                      const evSpec = currentSpec.namespaces[namespaceName]?.events[eventName];
                      if (evSpec && (!evSpec.examples || evSpec.examples.length === 0)) {
                        registry.declare(namespaceName, eventName, {
                          examples: [sample],
                        });
                      }
                    }
                  }
                }
              }
            } catch {
              // Never throw into user code
            }
          });
        } catch {
          // Ignore if onAnyOutgoing throws
        }
      }
    } catch {
      // Defensive wrapping
    }
  };

  const hookNamespace = (nsp: Namespace) => {
    if (!nsp || hookedNamespaces.has(nsp)) return;
    hookedNamespaces.add(nsp);

    try {
      const namespaceName = nsp.name || "/";
      registry.namespace(namespaceName);

      const connectionListener = (socket: Socket) => {
        hookSocket(namespaceName, socket);
      };

      // prependListener (available on Socket.IO namespaces) makes our hook run
      // BEFORE handlers registered by the framework (e.g. NestJS gateway
      // connection handlers), so events emitted while handling a connection
      // and handlers registered from there are still captured.
      if (typeof (nsp as any).prependListener === "function") {
        (nsp as any).prependListener("connection", connectionListener);
      } else {
        nsp.on("connection", connectionListener);
      }
    } catch {
      // Defensive wrapping
    }
  };

  // A bare Namespace was passed in: hook just that namespace.
  if (looksLikeNamespace(io)) {
    hookNamespace(io as unknown as Namespace);
    return;
  }

  try {
    // Hook all existing namespaces
    for (const nsp of getAllNamespaces(io)) {
      hookNamespace(nsp);
    }

    // Hook future namespaces if supported via new_namespace event
    if (typeof (io as any).on === "function") {
      (io as any).on("new_namespace", (nsp: Namespace) => {
        hookNamespace(nsp);
      });
    }
  } catch {
    // Ignore errors
  }
}

