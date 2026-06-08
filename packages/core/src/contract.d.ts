import { ZodTypeAny } from "zod";
import { PluginManager, SocketDocsPlugin } from "./plugins.js";
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
export declare function createContract(options: ContractOptions): {
    namespace: (nsName: string) => {
        event<P extends ZodTypeAny, R extends ZodTypeAny>(def: EventDefinition<P, R>): {
            errors(errs: ErrorDefinition[]): /*elided*/ any;
            definition: EventDefinition<P, R>;
        };
    };
    registerNamespaceClass: (target: any) => void;
    generateSpec: () => any;
    _namespaces: Map<string, NamespaceDefinition>;
    options: ContractOptions;
    registerPlugin(plugin: SocketDocsPlugin): void;
    plugins: PluginManager;
};
export type Contract = ReturnType<typeof createContract>;
