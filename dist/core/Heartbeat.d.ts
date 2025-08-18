import { HeartbeatConfig, WebSocketConfig } from '../types';
import { EventEmitter } from "./EventEmitter";
export declare class Heartbeat extends EventEmitter {
    private config;
    private readonly sendPing;
    private lastPongTime;
    private intervalId?;
    private timeoutId?;
    constructor(config: HeartbeatConfig, sendPing: () => void);
    start(): void;
    stop(): void;
    handleDefaultTimeout(cb?: () => void): void;
    recordPong(): void;
    getLastPongTime(): number;
    updateConfig(config?: WebSocketConfig): void;
}
