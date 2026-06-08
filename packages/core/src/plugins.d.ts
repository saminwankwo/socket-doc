import { Contract } from "./contract.js";
export interface SocketDocsPlugin {
    name: string;
    version: string;
    onSetup?: (contract: Contract) => void;
    onEvent?: (eventName: string, payload: any, namespace: string) => void;
    onSpecGenerated?: (spec: any) => void;
}
export declare class PluginManager {
    private contract;
    private plugins;
    constructor(contract: Contract);
    register(plugin: SocketDocsPlugin): void;
    notifyEvent(eventName: string, payload: any, namespace: string): void;
    notifySpecGenerated(spec: any): void;
}
