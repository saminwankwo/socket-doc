export type Direction = "client_to_server" | "server_to_client" | "bidirectional";

export type EventKind = "fire_and_forget" | "request_response";

export type EventSource = "sniffed" | "declared" | "decorator";

export interface ErrorSpec {
  code: string | number;
  description: string;
}

export interface SecuritySpec {
  name: string;
  type: "apiKey" | "http" | "oauth2";
  in?: "header" | "query" | "cookie" | "auth";
  description?: string;
}

export interface EventSpec {
  name: string;
  namespace: string;
  direction: Direction;
  kind?: EventKind;
  summary?: string;
  description?: string;
  payloadSchema?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  examples?: unknown[];
  errors?: ErrorSpec[];
  tags?: string[];
  deprecated?: boolean;
  authRequired?: boolean;
  source: EventSource;
}

export interface NamespaceSpec {
  name: string;
  description?: string;
  events: Record<string, EventSpec>;
}

export interface SocketDocsSpec {
  specVersion: "1.0";
  info: { title: string; version: string; description?: string };
  servers?: Array<{ url: string; label?: string }>;
  socketPath?: string;
  security?: SecuritySpec[];
  namespaces: Record<string, NamespaceSpec>;
}
