import { EventEmitter } from "./EventEmitter";
export declare class Heartbeat extends EventEmitter {
    private readonly sendPing;
    private intervalMs;
    private timeoutMs;
    private lastPongTime;
    private intervalId?;
    private timeoutId?;
    constructor(intervalMs: number, timeoutMs: number, sendPing: () => void);
    start(): void;
    stop(): void;
    recordPong(): void;
    getLastPongTime(): number;
}
