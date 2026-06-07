import { zodToJsonSchema } from "zod-to-json-schema";
import { ZodTypeAny } from "zod";
import { PluginManager, SocketDocsPlugin } from "./plugins"

export type Direction = 'client_to_server' | 'server_to_client' | 'bidirectional';

export type EventType = 'fire_and_forget' | 'request_response';

export interface ErrorDefinition {
  code: string | number;
  description: string;
}

export interface EventDefinition<P extends ZodTypeAny = any, R extends ZodTypeAny = any> {
  name: string;
  direction: Direction;
  type?: EventType;
  summary?: string;
  description?: string;
  payload?: P;
  response?: R;
  payloadSchema?: any;
  responseSchema?: any;
  roles?: string[];
  authRequired?: boolean;
  examples?: any[];
  errors?: ErrorDefinition[];
}

export interface NamespaceDefinition {
  name: string;
  events: Map<string, EventDefinition>;
}

export interface SecurityRequirement {
  name: string;
  type: 'apiKey' | 'http' | 'oauth2';
  in?: 'header' | 'query' | 'cookie';
  description?: string;
}

export interface ContractOptions {
  name: string;
  version: string;
  description?: string;
  security?: SecurityRequirement[];
}

export function createContract(options: ContractOptions) {
  const namespaces = new Map<string, NamespaceDefinition>();

  const contract = {
    namespace,
    registerNamespaceClass,
    generateSpec,
    _namespaces: namespaces,
    options,
    registerPlugin(plugin: SocketDocsPlugin) {
      this.plugins.register(plugin);
    },
    plugins: null as any as PluginManager
  };

  contract.plugins = new PluginManager(contract as any);

  function namespace(nsName: string) {
    if (!namespaces.has(nsName)) {
      namespaces.set(nsName, {
        name: nsName,
        events: new Map<string, EventDefinition>()
      });
    }
    const ns = namespaces.get(nsName)!;
    const nsBuilder = {
      event<P extends ZodTypeAny, R extends ZodTypeAny>(def: EventDefinition<P, R>) {
        if (ns.events.has(def.name)) {
          throw new Error(`Event exists: ${nsName}.${def.name}`);
        }
        ns.events.set(def.name, def);
        
        const eventBuilder = {
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

export type Contract = ReturnType<typeof createContract>;
