import { HeartbeatConfig, WebSocketConfig } from "@/types";
import { EventEmitter } from "./EventEmitter";

export class Heartbeat extends EventEmitter {
  private lastPongTime: number = 0;
  private intervalId?: NodeJS.Timeout;
  private timeoutId?: NodeJS.Timeout;

  constructor(
    private config: HeartbeatConfig = {},
    private readonly sendPing: () => void
  ) {
    super();
  }

  start(): void {
    if (!this.config) {
      console.log("[Heartbeat] config is empty");
    }
    this.stop();
    this.lastPongTime = Date.now();
    this.intervalId = setInterval(() => {
      this.sendPing();
      this.timeoutId = setTimeout(() => {
        this.handleDefaultTimeout(this.config.onTimeout);
      }, this.config.timeout);
    }, this.config.interval);
  }

  stop(): void {
    clearInterval(this.intervalId);
    clearTimeout(this.timeoutId);
  }

  handleDefaultTimeout(cb?: () => void): void {
    this.stop();
    cb && cb();
    this.emit("timeout");
  }

  recordPong(): void {
    this.lastPongTime = Date.now();
    clearTimeout(this.timeoutId);
    this.emit("pong", Date.now() - this.lastPongTime);
  }

  getLastPongTime(): number {
    return this.lastPongTime;
  }

  updateConfig(config?: WebSocketConfig) {
    if (!config?.isNeedHeartbeat) {
      this.stop();
      return;
    }
    this.config = { ...this.config, ...config.heartbeat };
    this.stop();
    this.start();
  }
}
