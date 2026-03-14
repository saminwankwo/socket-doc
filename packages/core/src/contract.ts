import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

export interface EventDefinition<P extends z.ZodTypeAny = any, R extends z.ZodTypeAny = any> {
  name: string
  direction: "client_to_server" | "server_to_client" | "bidirectional"
  payload?: P
  response?: R
  description?: string
}

export interface Namespace {
  name: string
  events: Map<string, EventDefinition>
}

export interface ContractOptions {
  name: string
  version: string
  description?: string
}

export function createContract(options: ContractOptions) {
  const namespaces = new Map<string, Namespace>()

  function namespace(name: string) {
    if (!namespaces.has(name)) {
      namespaces.set(name, {
        name,
        events: new Map<string, EventDefinition>()
      })
    }

    const ns = namespaces.get(name)!

    return {
      event<P extends z.ZodTypeAny, R extends z.ZodTypeAny>(def: EventDefinition<P, R>) {
        ns.events.set(def.name, def)
        return def
      }
    }
  }

  function generateSpec() {
    const spec: any = {
      specVersion: "0.1",
      info: {
        name: options.name,
        version: options.version,
        description: options.description
      },
      namespaces: {}
    }

    for (const [nsName, ns] of namespaces) {
      spec.namespaces[nsName] = {
        name: nsName,
        events: {}
      }

      for (const [eventName, def] of ns.events) {
        spec.namespaces[nsName].events[eventName] = {
          direction: def.direction,
          description: def.description,
          payloadSchema: def.payload ? zodToJsonSchema(def.payload) : null,
          responseSchema: def.response ? zodToJsonSchema(def.response) : null
        }
      }
    }

    return spec
  }

  return {
    namespace,
    generateSpec,
    _namespaces: namespaces,
    options
  }
}

export type Contract = ReturnType<typeof createContract>
