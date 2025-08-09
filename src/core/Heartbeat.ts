import { EventEmitter } from "./EventEmitter";

export class Heartbeat extends EventEmitter {
  private intervalMs: number;
  private timeoutMs: number;
  private lastPongTime: number = 0;
  private intervalId?: NodeJS.Timeout;
  private timeoutId?: NodeJS.Timeout;

  constructor(
    intervalMs: number,
    timeoutMs: number,
    private readonly sendPing: () => void
  ) {
    super();
    this.intervalMs = intervalMs;
    this.timeoutMs = timeoutMs;
  }

  start(): void {
    this.stop();
    this.lastPongTime = Date.now();
    this.intervalId = setInterval(() => {
      this.sendPing();
      this.timeoutId = setTimeout(() => {
        this.emit("timeout");
      }, this.timeoutMs);
    }, this.intervalMs);
  }

  stop(): void {
    clearInterval(this.intervalId);
    clearTimeout(this.timeoutId);
  }

  recordPong(): void {
    this.lastPongTime = Date.now();
    clearTimeout(this.timeoutId);
    this.emit("pong", Date.now() - this.lastPongTime);
  }

  getLastPongTime(): number {
    return this.lastPongTime;
  }
}
