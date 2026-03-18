import { HeartbeatConfig, WebSocketConfig } from '../types';
import { EventEmitter } from './EventEmitter';
export declare class Heartbeat extends EventEmitter {
    private config;
    private readonly sendPing;
    private lastPongTime;
    private lastPingTime;
    private pingTimer?;
    private pongTimeoutTimer?;
    private expectedNextPingAt;
    private isRunning;
    private timer;
    constructor(config: HeartbeatConfig | undefined, sendPing: () => void);
    start(): void;
    stop(): void;
    handleDefaultTimeout(cb?: () => void): void;
    recordPong(): void;
    getLastPongTime(): number;
    /**
     * 基于真实时间差做一次超时校验（用于从后台切回前台等场景）
     * @returns true 表示已超时
     */
    checkTimeout(): boolean;
    updateConfig(config?: WebSocketConfig): void;
    private scheduleNextPing;
    /**
     * 超时检测应以 lastPongTime 为基准：
     * - interval 可能小于 timeout，不能在每次 ping 时重置 timeout，否则会导致永不超时
     * - 这里只在 start/recordPong 时重置检测定时器
     */
    private schedulePongTimeoutCheck;
}
