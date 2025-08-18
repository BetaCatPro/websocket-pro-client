import { Heartbeat } from "./Heartbeat";
import { TaskScheduler } from "./TaskScheduler";
import { EventEmitter } from "./EventEmitter";
import { WebSocketConfig } from "../types";
import { DEFAULT_CONFIG } from "../config";
import { deepMerge, isEqual } from "../utils";

export class WebSocketClient extends EventEmitter {
  private currentConfig: Required<WebSocketConfig>;
  private socket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer?: NodeJS.Timeout;
  private readonly messageQueue: Array<{
    data: any;
    priority: number;
    resolve: () => void;
    reject: (err: Error) => void;
  }> = [];
  private heartbeat?: Heartbeat;
  private readonly scheduler: TaskScheduler;

  // 解决配置更新的线程安全与竞态条件
  private isUpdatingConfig = false;
  private configQueue: WebSocketConfig[] = [];
  constructor(
    private readonly url: string,
    private readonly protocols: string[],
    private config: Required<WebSocketConfig>
  ) {
    super();
    this.currentConfig = deepMerge(DEFAULT_CONFIG, this.config);
    this.initHeartbeat();
    this.scheduler = new TaskScheduler(
      this.currentConfig.maxConcurrent,
      (err) => this.emit("error", err)
    );
    this.connect();
  }

  // 初始化心跳
  private initHeartbeat() {
    if (!this.currentConfig.isNeedHeartbeat) return;
    this.heartbeat = new Heartbeat(this.currentConfig.heartbeat, () => {
      this.send(this.currentConfig.heartbeat?.message || "PING");
    });

    this.heartbeat.on("timeout", () => {
      console.log("Heartbeat timeout, triggering reconnect...");
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.close(1000, "heartbeat timeout");
      }
      this.scheduleReconnect();
    });
  }

  private connect(): void {
    this.socket = new WebSocket(this.url, this.protocols);
    this.socket.binaryType = "arraybuffer";

    this.socket.onopen = (event) => {
      this.reconnectAttempts = 0;
      clearTimeout(this.reconnectTimer);
      this.heartbeat && this.heartbeat.start();
      this.flushMessageQueue();
      this.emit("open", event);
    };

    this.socket.onmessage = (event) => {
      if (event.data === "pong") {
        this.heartbeat && this.heartbeat.recordPong();
        return;
      }
      this.emit("message", event.data);
    };

    this.socket.onclose = (event) => {
      this.heartbeat && this.heartbeat.stop();
      this.emit("close", event);
    };

    this.socket.onerror = (event) => {
      this.heartbeat && this.heartbeat.stop();
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
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.emit("overMaxReconnectAttempts");
      return;
    }

    const delay = Math.min(
      this.currentConfig.reconnectDelay *
        Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay
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
    priority: number = this.currentConfig.defaultPriority
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
    this.heartbeat && this.heartbeat.stop();
    this.socket?.close(code, reason);
    this.socket = null;
  }

  reconnect(): void {
    clearTimeout(this.reconnectTimer);
    this.reconnectAttempts = 0;
    this.close();
    this.connect();
  }

  // 配置更新方法
  async updateConfig(newConfig: WebSocketConfig) {
    this.configQueue.push(newConfig);
    if (this.isUpdatingConfig) return;

    this.isUpdatingConfig = true;
    while (this.configQueue.length > 0) {
      const config = this.configQueue.shift()!;
      await this.applyConfigSafely(config);
    }
    this.isUpdatingConfig = false;
  }

  private applyConfigSafely(config: WebSocketConfig) {
    const prevConfig = { ...this.currentConfig };
    this.currentConfig = deepMerge(this.currentConfig, config);

    this.handleConfigChange(prevConfig, this.currentConfig);
    this.applyConfig();
  }

  // 处理特定配置变更
  private handleConfigChange(prev: WebSocketConfig, current: WebSocketConfig) {
    // 心跳配置变化
    if (!isEqual(prev.heartbeat, current.heartbeat)) {
      this.reInitHeartbeat();
    }

    // 重连策略变化
    if (
      prev.maxReconnectAttempts !== current.maxReconnectAttempts ||
      prev.reconnectDelay !== current.reconnectDelay ||
      prev.reconnectExponent !== current.reconnectExponent ||
      prev.maxReconnectDelay !== current.maxReconnectDelay
    ) {
      this.resetReconnectTimer();
    }
  }

  // 应用新配置到各模块
  private applyConfig() {
    this.heartbeat?.updateConfig(this.currentConfig);
    this.scheduler?.updateThresholds(this.currentConfig.maxConcurrent);
  }

  private reInitHeartbeat(): void {
    if (!this.currentConfig.isNeedHeartbeat) {
      this.heartbeat?.stop();
      this.heartbeat = undefined;
      return;
    }

    if (!this.heartbeat) {
      this.initHeartbeat();
    } else {
      this.heartbeat.stop();
      this.heartbeat.start();
    }
  }

  private resetReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.scheduleReconnect();
    }
  }
}
