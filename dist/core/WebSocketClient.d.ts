import { EventEmitter } from "./EventEmitter";
import { WebSocketConfig } from "../types";
export declare class WebSocketClient extends EventEmitter {
    private readonly url;
    private readonly protocols;
    private readonly config;
    private socket;
    private reconnectAttempts;
    private reconnectTimer?;
    private readonly messageQueue;
    private readonly heartbeat;
    private readonly scheduler;
    constructor(url: string, protocols: string[], config: Required<WebSocketConfig>);
    private connect;
    private sendRaw;
    private scheduleReconnect;
    private flushMessageQueue;
    send(data: any, priority?: number): Promise<void>;
    close(code?: number, reason?: string): void;
    reconnect(): void;
}
