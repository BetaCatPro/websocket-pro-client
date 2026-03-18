import { EventEmitter } from './EventEmitter';
import { WebSocketConfig } from '../types';
export declare class WebSocketClient extends EventEmitter {
    private readonly url;
    private readonly protocols;
    private config;
    private currentConfig;
    private socket;
    private reconnectAttempts;
    private reconnectTimer?;
    private readonly messageQueue;
    private heartbeat?;
    private readonly scheduler;
    private readonly pendingAcks;
    private lastInboundSeq?;
    private isUpdatingConfig;
    private configQueue;
    constructor(url: string, protocols: string[], config: Required<WebSocketConfig>);
    private initHeartbeat;
    private connect;
    private sendRaw;
    /**
     * 心跳专用发送通道：
     * - 绕过 TaskScheduler（不占用并发槽位）
     * - 不参与 ACK / 序列号包装（保持尽可能轻量）
     */
    private sendHeartbeat;
    private scheduleReconnect;
    private flushMessageQueue;
    private sendInternal;
    private handleAckTimeout;
    send(data: any, priority?: number): Promise<void>;
    sendWithAck(data: any, priority?: number): Promise<void>;
    getLastInboundSeq(): string | number | undefined;
    updateLastInboundSeq(seq: string | number): void;
    close(code?: number, reason?: string): void;
    reconnect(): void;
    updateConfig(newConfig: WebSocketConfig): Promise<void>;
    private applyConfigSafely;
    private handleConfigChange;
    private applyConfig;
    private reInitHeartbeat;
    private resetReconnectTimer;
}
