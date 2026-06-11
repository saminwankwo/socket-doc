import { WebSocketServer, WebSocket } from "ws";
import { Contract } from "@socketdocs/core";
import { IncomingMessage, ServerResponse } from "http";
export interface WsAdapterOptions {
    onAuth?: (socket: WebSocket, request: any) => Promise<{
        userId?: string;
        roles?: string[];
    } | null>;
    logger?: (msg: string) => void;
}
/**
 * Helper to serve documentation from a standard HTTP server
 */
export declare function handleWsDocs(req: IncomingMessage, res: ServerResponse, contract: Contract, path?: string): boolean;
export declare function bindWsAdapter(wss: WebSocketServer, contract: Contract, handlers: any, opts?: WsAdapterOptions): {
    send: (socket: WebSocket, nsName: string, eventName: string, payload: any) => void;
};
