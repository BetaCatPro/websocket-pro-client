import { HeartbeatConfig } from '../types';
export type TimerId = number;
export type TimerHandler = () => void;
export type TimerProvider = {
    setTimeout(handler: TimerHandler, delay: number): TimerId;
    clearTimeout(id?: TimerId): void;
    destroy?: () => void;
};
export declare function createHeartbeatTimer(config: HeartbeatConfig): TimerProvider;
