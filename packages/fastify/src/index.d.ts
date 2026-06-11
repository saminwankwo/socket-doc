import { FastifyInstance, FastifyRequest } from "fastify";
import { WebSocket } from "@fastify/websocket";
import { Contract } from "@socketdocs/core";
export interface FastifyAdapterOptions {
    onAuth?: (connection: WebSocket, request: FastifyRequest) => Promise<{
        userId?: string;
        roles?: string[];
    } | null>;
    logger?: (msg: string) => void;
}
export declare function serveFastifyDocs(fastify: FastifyInstance, contract: Contract, path?: string): void;
export declare function bindFastifyAdapter(fastify: FastifyInstance, contract: Contract, handlers: any, opts?: FastifyAdapterOptions): void;
