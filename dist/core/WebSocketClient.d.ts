import { EventEmitter } from './EventEmitter';
import { ResetStatsOptions, WebSocketClientState, WebSocketConfig } from '../types';
export declare class WebSocketClient extends EventEmitter {
    private readonly url;
    private readonly protocols;
    private config;
    private currentConfig;
    private socket;
    private reconnectAttempts;
    private reconnectTimer?;
    private isManualClose;
    private isOverMaxReconnectAttempts;
    private readonly messageQueue;
    private heartbeat?;
    private readonly scheduler;
    private readonly topicListeners;
    private lastHeartbeatLatency?;
    private lastErrorAt?;
    private lastCloseCode?;
    private lastCloseReason?;
    private lastCloseAt?;
    private sentCount;
    private receivedCount;
    private errorCount;
    private reconnectScheduledCount;
    private ackTimeoutCount;
    private readonly pendingAcks;
    private lastInboundSeq?;
    private isUpdatingConfig;
    private configQueue;
    constructor(url: string, protocols: string[], config: Required<WebSocketConfig>);
    private initHeartbeat;
    private connect;
    private sendRaw;
    private dispatchSubscribedMessage;
    private isTopicMatch;
    private reSyncSubscriptions;
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
    getState(): WebSocketClientState;
    getStats(): {
        sentCount: number;
        receivedCount: number;
        errorCount: number;
        reconnectScheduledCount: number;
        ackTimeoutCount: number;
        reconnectAttempts: number;
        pendingAcksCount: number;
        messageQueueLength: number;
        subscribedTopicCount: number;
        subscriptionListenerCount: number;
        lastInboundSeq: string | number | undefined;
        socketReadyState: number | null;
        lastHeartbeatLatency: number | undefined;
        lastErrorAt: number | undefined;
        lastCloseCode: number | undefined;
        lastCloseReason: string | undefined;
        lastCloseAt: number | undefined;
    };
    resetStats(options?: ResetStatsOptions): void;
    subscribe(topic: string, listener: (data: any) => void): () => void;
    subscribeOnce(topic: string, listener: (data: any) => void): () => void;
    unsubscribe(topic: string, listener?: (data: any) => void): void;
    close(code?: number, reason?: string): void;
    reconnect(): void;
    updateConfig(newConfig: WebSocketConfig): Promise<void>;
    private applyConfigSafely;
    private handleConfigChange;
    private applyConfig;
    private reInitHeartbeat;
    private resetReconnectTimer;
}
