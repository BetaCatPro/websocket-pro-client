import { WebSocketClient } from "./WebSocketClient";
import { EventEmitter } from "./EventEmitter";
import { WebSocketConfig } from "../types";
export declare class WebSocketManager extends EventEmitter {
    private readonly config;
    private readonly clients;
    constructor(config: Required<WebSocketConfig>);
    connect(url: string, protocols?: string[]): WebSocketClient;
    closeAll(code?: number, reason?: string): void;
    getClient(url: string, protocols?: string[]): WebSocketClient | undefined;
}
