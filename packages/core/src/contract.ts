import { zodToJsonSchema } from "zod-to-json-schema";
import { ZodTypeAny } from "zod";
import { PluginManager, SocketDocsPlugin } from "./plugins.js"

/**
 * The direction of an event - whether it's sent from client to server, server to client, or both
 */
export type Direction = 'client_to_server' | 'server_to_client' | 'bidirectional';

/**
 * The type of an event - fire-and-forget (no response expected) or request-response (ack expected)
 */
export type EventType = 'fire_and_forget' | 'request_response';

/**
 * Definition of an error that can be returned by an event
 */
export interface ErrorDefinition {
  /** Unique error code */
  code: string | number;
  /** Human-readable description of the error */
  description: string;
}

/**
 * Definition of a WebSocket event
 */
export interface EventDefinition<P extends ZodTypeAny = any, R extends ZodTypeAny = any> {
  /** Name of the event */
  name: string;
  /** Direction of the event */
  direction: Direction;
  /** Type of the event (fire-and-forget or request-response) */
  type?: EventType;
  /** Short summary of what the event does */
  summary?: string;
  /** Detailed description of the event */
  description?: string;
  /** Zod schema for the payload */
  payload?: P;
  /** Zod schema for the response (for request-response events) */
  response?: R;
  /** Raw JSON schema for the payload (alternative to Zod schema) */
  payloadSchema?: any;
  /** Raw JSON schema for the response (alternative to Zod schema) */
  responseSchema?: any;
  /** Array of roles that are allowed to access this event */
  roles?: string[];
  /** Whether authentication is required to access this event */
  authRequired?: boolean;
  /** Example payloads for documentation */
  examples?: any[];
  /** Possible errors that can be returned by this event */
  errors?: ErrorDefinition[];
}

/**
 * Definition of a namespace containing multiple events
 */
export interface NamespaceDefinition {
  /** Name of the namespace */
  name: string;
  /** Map of event names to event definitions */
  events: Map<string, EventDefinition>;
}

/**
 * Security requirement definition for the API
 */
export interface SecurityRequirement {
  /** Name of the security scheme */
  name: string;
  /** Type of security scheme */
  type: 'apiKey' | 'http' | 'oauth2';
  /** Where the API key is located (header, query, or cookie) */
  in?: 'header' | 'query' | 'cookie';
  /** Description of the security requirement */
  description?: string;
}

/**
 * Options for creating a contract
 */
export interface ContractOptions {
  /** Name of the API */
  name: string;
  /** Version of the API */
  version: string;
  /** Description of the API */
  description?: string;
  /** Array of security requirements for the API */
  security?: SecurityRequirement[];
}

/**
 * Creates a new SocketDocs contract
 * 
 * @param options - The contract configuration options
 * @returns A new contract instance that you can use to define namespaces and events
 * 
 * @example
 * ```typescript
 * import { createContract } from "@socketdocs/core";
 * import { z } from "zod";
 * 
 * const contract = createContract({
 *   name: "Chat API",
 *   version: "1.0.0",
 *   description: "A realtime chat API"
 * });
 * 
 * const chat = contract.namespace("chat");
 * 
 * chat.event({
 *   name: "send_message",
 *   direction: "client_to_server",
 *   payload: z.object({
 *     text: z.string(),
 *     roomId: z.string()
 *   })
 * });
 * ```
 */
export function createContract(options: ContractOptions) {
  const namespaces = new Map<string, NamespaceDefinition>();

  const contract = {
    namespace,
    registerNamespaceClass,
    generateSpec,
    _namespaces: namespaces,
    options,
    /**
     * Registers a plugin with the contract
     * 
     * @param plugin - The plugin to register
     */
    registerPlugin(plugin: SocketDocsPlugin) {
      this.plugins.register(plugin);
    },
    plugins: null as any as PluginManager
  };

  contract.plugins = new PluginManager(contract as any);

  /**
   * Creates or retrieves a namespace in the contract
   * 
   * @param nsName - Name of the namespace
   * @returns A namespace builder for defining events
   */
  function namespace(nsName: string) {
    if (!namespaces.has(nsName)) {
      namespaces.set(nsName, {
        name: nsName,
        events: new Map<string, EventDefinition>()
      });
    }
    const ns = namespaces.get(nsName)!;
    const nsBuilder = {
      /**
       * Adds a new event to the namespace
       * 
       * @param def - The event definition
       * @returns An event builder for adding errors to the event
       */
      event<P extends ZodTypeAny, R extends ZodTypeAny>(def: EventDefinition<P, R>) {
        if (ns.events.has(def.name)) {
          throw new Error(`Event exists: ${nsName}.${def.name}`);
        }
        ns.events.set(def.name, def);
        
        const eventBuilder = {
          /**
           * Adds possible error definitions to the event
           * 
           * @param errs - Array of error definitions
           * @returns The event builder for chaining
           */
          errors(errs: ErrorDefinition[]) {
            def.errors = [...(def.errors || []), ...errs];
            return eventBuilder;
          },
          definition: def
        };
        return eventBuilder;
      }
    };
    return nsBuilder;
  }

  /**
   * Registers a class-based namespace using decorators
   * 
   * @param target - The class to register as a namespace
   */
  function registerNamespaceClass(target: any) {
    const nsName = target.__socketdocs_namespace || target.name;
    const ns = namespace(nsName);
    const events = target.__socketdocs_events || [];

    for (const e of events) {
      ns.event({
        name: e.name,
        direction: e.direction,
        // In a more advanced implementation, we'd extract schemas here
      });
    }
  }

  /**
   * Generates a JSON spec from the contract
   * 
   * @returns The generated JSON spec
   */
  function generateSpec() {
    const spec: any = {
      specVersion: "1.0.0",
      info: {
        name: options.name,
        version: options.version,
        description: options.description || ""
      },
      security: options.security || [],
      servers: [],
      namespaces: {}
    };

    for (const [nsName, ns] of namespaces.entries()) {
      spec.namespaces[nsName] = {
        name: nsName,
        events: {}
      };
      for (const [evtName, def] of ns.events.entries()) {
        spec.namespaces[nsName].events[evtName] = {
          direction: def.direction,
          type: def.type ?? "fire_and_forget",
          summary: def.summary,
          description: def.description,
          payloadSchema: def.payloadSchema || (def.payload ? zodToJsonSchema(def.payload) : null),
          responseSchema: def.responseSchema || (def.response ? zodToJsonSchema(def.response) : null),
          roles: def.roles ?? [],
          authRequired: !!def.authRequired,
          examples: def.examples ?? [],
          errors: def.errors ?? []
        };
      }
    }
    return spec;
  }

  return contract;
}

/**
 * Type representing a SocketDocs contract instance
 */
export type Contract = ReturnType<typeof createContract>;
