import { Heartbeat } from "./Heartbeat";
import { TaskScheduler } from "./TaskScheduler";
import { EventEmitter } from "./EventEmitter";
import { WebSocketConfig } from "../types";

export class WebSocketClient extends EventEmitter {
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly messageQueue: Array<{
    data: any;
    priority: number;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private readonly heartbeat: Heartbeat;
  private readonly scheduler: TaskScheduler;

  constructor(
    private readonly url: string,
    private readonly protocols: string[],
    private readonly config: Required<WebSocketConfig>
  ) {
    super();
    this.heartbeat = new Heartbeat(
      config.heartbeatInterval,
      config.heartbeatTimeout,
      () => this.sendRaw("ping")
    );
    this.scheduler = new TaskScheduler(1, (err) => this.emit("error", err));
    this.connect();
  }

  private connect(): void {
    this.socket = new WebSocket(this.url, this.protocols);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = (event) => {
      this.reconnectAttempts = 0;
      this.heartbeat.start();
      this.flushMessageQueue();
      this.emit("open", event);
    };

    this.socket.onmessage = (event) => {
      if (event.data === "pong") {
        this.heartbeat.recordPong();
        return;
      }
      this.emit("message", event.data);
    };

    this.socket.onclose = (event) => {
      this.heartbeat.stop();
      this.emit("close", event);
    };

    this.socket.onerror = (event) => {
      this.emit("error", event);
      this.scheduleReconnect();
    };
  }

  private sendRaw(data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) return;

    const delay = Math.min(
      this.config.reconnectDelay *
        Math.pow(this.config.reconnectExponent, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );

    // 添加随机抖动（避免集群同时重连的"惊群效应"）
    const jitterRatio = 0.2; // ±20%的随机波动
    const jitter = delay * jitterRatio * (Math.random() * 2 - 1); // [-0.2,0.2]范围
    const actualDelay = Math.max(1000, delay + jitter); // 保证至少1秒

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      this.connect();
    }, actualDelay);
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const { data, resolve, reject } = this.messageQueue.shift()!;
      this.send(data).then(resolve).catch(reject);
    }
  }

  send(
    data: any,
    priority: number = this.config.defaultPriority
  ): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      return this.scheduler.add(() => {
        return new Promise((resolve, reject) => {
          try {
            this.sendRaw(data);
            resolve();
          } catch (err) {
            reject(err);
          }
        });
      }, priority);
    }

    return new Promise((resolve, reject) => {
      this.messageQueue.push({ data, priority, resolve, reject });
    });
  }

  close(code?: number, reason?: string): void {
    clearTimeout(this.reconnectTimer);
    this.heartbeat.stop();
    this.socket?.close(code, reason);
    this.socket = null;
  }

  reconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    this.close();
    this.connect();
  }
}
