export interface Serializer<T = any> {
  /**
   * 将数据序列化为字符串或二进制
   */
  serialize(data: T): string | ArrayBuffer

  /**
   * 反序列化接收到的数据
   */
  deserialize(data: string | ArrayBuffer): T
}

export type HeartbeatConfig = {
  /** 心跳间隔(ms) (默认: 25000) */
  interval?: number
  /** 心跳超时(ms) (默认: 10000) */
  timeout?: number
  /** 心跳消息 (默认: "PING") */
  message?: string
  /** 自定义超时处理 */
  onTimeout?: () => void
}

/**
 * 消息 ACK 配置
 */
export type AckStrategy = {
  /** 是否开启 ACK 机制 (默认: true) */
  enabled?: boolean
  /** ACK 超时时间(ms) (默认: 5000) */
  timeout?: number
  /** 最大重试次数 (默认: 2) */
  maxRetries?: number
  /**
   * 生成消息 ID（默认自增）
   */
  generateId?: () => string | number
  /**
   * 发出消息时的包装
   * @example 默认: (id, data) => ({ id, payload: data })
   */
  wrapOutbound?: (id: string | number, data: any) => any
  /**
   * 从服务端消息中解析 ACK 所属的消息 ID
   * 返回 null 表示不是 ACK 消息
   */
  extractAckId?: (message: any) => string | number | null
}

/**
 * 消息序列号配置
 */
export type SequenceStrategy = {
  /** 是否开启本地序列号 (默认: true) */
  enabled?: boolean
  /** 生成序列号（默认自增） */
  generateSeq?: () => string | number
  /**
   * 对外发数据加上 seq
   * @example 默认: (seq, data) => ({ seq, payload: data })
   */
  wrapOutbound?: (seq: string | number, data: any) => any
  /**
   * 解析入站消息的序列号
   */
  extractInboundSeq?: (message: any) => string | number | null
}

export interface WebSocketConfig {
  /** 最大重连尝试次数 (默认: 10) */
  maxReconnectAttempts?: number
  /** 初始重连延迟(ms) (默认: 1000) */
  reconnectDelay?: number
  /** 退避指数 (默认: 1.5) */
  reconnectExponent?: number
  /** 最大重连延迟(ms) (默认: 30000) */
  maxReconnectDelay?: number
  /** 连接池大小 (默认: 5) */
  connectionPoolSize?: number
  /** 最大并行任务数 (默认: 1) */
  maxConcurrent?: number
  /** 默认消息优先级 (默认: 1) */
  defaultPriority?: number
  /** 是否启用压缩 (默认: false) */
  enableCompression?: boolean
  /** 自定义序列化器 */
  serializer?: Serializer
  /** 消息 ACK 配置 */
  ack?: AckStrategy
  /** 消息序列号配置 */
  sequence?: SequenceStrategy
  /** 是否需要心跳 (默认: true) */
  isNeedHeartbeat?: boolean
  /** 心跳配置 */
  heartbeat?: HeartbeatConfig
}

import type { WebSocketEvent } from "../constants/events"
export { WebSocketEvent } from "../constants/events"

export interface IWebSocketClient {
  send(data: any, priority?: number): Promise<void>
  /**
   * 发送消息并等待 ACK
   * - 使用全局或自定义的 ACK 配置
   * - 返回的 Promise 会在收到 ACK、超时或重试失败后结束
   */
  sendWithAck(data: any, priority?: number): Promise<void>
  close(code?: number, reason?: string): void
  reconnect(): void
  on(event: WebSocketEvent, listener: (data: any) => void): void
  off(event: WebSocketEvent, listener: (data: any) => void): void
}

export interface IWebSocketManager {
  connect(url: string, protocols?: string[]): IWebSocketClient
  closeAll(code?: number, reason?: string): void
  on(event: WebSocketEvent, listener: (data: any) => void): void
}

export type Listener = (...args: any[]) => void

export interface Task {
  task: () => Promise<void>
  priority: number
}
