import { zodToJsonSchema } from "zod-to-json-schema";
import { PluginManager } from "./plugins.js";
export function createContract(options) {
    const namespaces = new Map();
    const contract = {
        namespace,
        registerNamespaceClass,
        generateSpec,
        _namespaces: namespaces,
        options,
        registerPlugin(plugin) {
            this.plugins.register(plugin);
        },
        plugins: null
    };
    contract.plugins = new PluginManager(contract);
    function namespace(nsName) {
        if (!namespaces.has(nsName)) {
            namespaces.set(nsName, {
                name: nsName,
                events: new Map()
            });
        }
        const ns = namespaces.get(nsName);
        const nsBuilder = {
            event(def) {
                if (ns.events.has(def.name)) {
                    throw new Error(`Event exists: ${nsName}.${def.name}`);
                }
                ns.events.set(def.name, def);
                const eventBuilder = {
                    errors(errs) {
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
    function registerNamespaceClass(target) {
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
        const spec = {
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
