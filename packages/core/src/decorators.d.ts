export declare function Namespace(name: string): (target: any) => void;
export declare function Event(name: string, direction?: "client_to_server" | "server_to_client" | "bidirectional"): (target: any, key: string) => void;
