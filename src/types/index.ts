export interface Serializer<T = any> {
  /**
   * 将数据序列化为字符串或二进制
   */
  serialize(data: T): string | ArrayBuffer;

  /**
   * 反序列化接收到的数据
   */
  deserialize(data: string | ArrayBuffer): T;
}

export interface WebSocketConfig {
  /** 最大重连尝试次数 (默认: 10) */
  maxReconnectAttempts?: number;
  /** 初始重连延迟(ms) (默认: 1000) */
  reconnectDelay?: number;
  /** 退避指数 (默认: 1.5) */
  reconnectExponent?: number;
  /** 最大重连延迟(ms) (默认: 30000) */
  maxReconnectDelay?: number;
  /** 心跳间隔(ms) (默认: 25000) */
  heartbeatInterval?: number;
  /** 心跳超时(ms) (默认: 10000) */
  heartbeatTimeout?: number;
  /** 连接池大小 (默认: 5) */
  connectionPoolSize?: number;
  /** 默认消息优先级 (默认: 1) */
  defaultPriority?: number;
  /** 是否启用压缩 (默认: false) */
  enableCompression?: boolean;
  /** 自定义序列化器 */
  serializer?: Serializer;
}

export type WebSocketEvent =
  | "open"
  | "message"
  | "close"
  | "error"
  | "reconnect"
  | "heartbeat"
  | "latency";

export interface IWebSocketClient {
  send(data: any, priority?: number): Promise<void>;
  close(code?: number, reason?: string): void;
  reconnect(): void;
  on(event: WebSocketEvent, listener: (data: any) => void): void;
  off(event: WebSocketEvent, listener: (data: any) => void): void;
}

export interface IWebSocketManager {
  connect(url: string, protocols?: string[]): IWebSocketClient;
  closeAll(code?: number, reason?: string): void;
  on(event: WebSocketEvent, listener: (data: any) => void): void;
}

export type Listener = (...args: any[]) => void;

export interface Task {
  task: () => Promise<void>;
  priority: number;
}
