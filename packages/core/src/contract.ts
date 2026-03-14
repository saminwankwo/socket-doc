import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"
import { PluginManager, SocketDocsPlugin } from "./plugins"

export interface EventDefinition<P extends z.ZodTypeAny = any, R extends z.ZodTypeAny = any> {
  name: string
  direction: "client_to_server" | "server_to_client" | "bidirectional"
  payload?: P
  response?: R
  description?: string
}

export interface NamespaceDefinition {
  name: string
  events: Map<string, EventDefinition>
}

export interface ContractOptions {
  name: string
  version: string
  description?: string
}

export function createContract(options: ContractOptions) {
  const namespaces = new Map<string, NamespaceDefinition>()

  const contract = {
    namespace,
    registerNamespaceClass,
    generateSpec,
    _namespaces: namespaces,
    options,
    registerPlugin(plugin: SocketDocsPlugin) {
      this.plugins.register(plugin)
    },
    plugins: null as any as PluginManager
  }

  contract.plugins = new PluginManager(contract as any)

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

  function registerNamespaceClass(target: any) {
    const nsName = target.__socketdocs_namespace || target.name
    const ns = namespace(nsName)
    const events = target.__socketdocs_events || []

    for (const e of events) {
      ns.event({
        name: e.name,
        direction: e.direction,
        // In a more advanced implementation, we'd extract schemas here
      })
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

  return contract
}

export type Contract = ReturnType<typeof createContract>
