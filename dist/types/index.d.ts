import { HeartbeatTimerMode } from '../constants/heartbeat';
import { WebSocketEvent } from '../constants/events';
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
export type HeartbeatConfig = {
    /** 心跳间隔(ms) (默认: 25000) */
    interval?: number;
    /** 心跳超时(ms) (默认: 45000) */
    timeout?: number;
    /** 心跳消息 (默认: "PING") */
    message?: string;
    /**
     * 用于发送 PING 的消息（默认: "PING"）
     * - 建议新项目使用 pingMessage/getPing，message 仍保留用于兼容旧版本
     */
    pingMessage?: any;
    /**
     * 自定义生成 PING 的函数（优先级高于 pingMessage/message）
     * - 适用于 ping 需要携带动态字段（时间戳、token、seq 等）的协议
     */
    getPing?: () => any;
    /**
     * 用于识别服务端的 PONG（默认: "PONG"）
     * - 简单场景直接配置一个值即可（会同时与 raw/parsed 做严格相等判断）
     */
    pongMessage?: any;
    /**
     * 自定义识别 PONG 的函数（优先级高于 pongMessage）
     * @param raw event.data 原始值
     * @param parsed 经过 serializer.deserialize 后的值（反序列化失败时等于 raw）
     */
    isPong?: (raw: any, parsed: any) => boolean;
    /**
     * 心跳计时器模式（默认: "auto"）
     * - auto: 优先使用 Web Worker（若不可用则回退主线程计时器）
     * - main: 强制使用主线程计时器
     * - worker: 强制使用 Web Worker 计时器（若不可用则回退主线程计时器）
     */
    timerMode?: HeartbeatTimerMode | "auto" | "main" | "worker";
    /** 自定义超时处理 */
    onTimeout?: () => void;
};
/**
 * 消息 ACK 配置
 */
export type AckStrategy = {
    /** 是否开启 ACK 机制 (默认: true) */
    enabled?: boolean;
    /** ACK 超时时间(ms) (默认: 5000) */
    timeout?: number;
    /** 最大重试次数 (默认: 2) */
    maxRetries?: number;
    /**
     * 生成消息 ID（默认自增）
     */
    generateId?: () => string | number;
    /**
     * 发出消息时的包装
     * @example 默认: (id, data) => ({ id, payload: data })
     */
    wrapOutbound?: (id: string | number, data: any) => any;
    /**
     * 从服务端消息中解析 ACK 所属的消息 ID
     * 返回 null 表示不是 ACK 消息
     */
    extractAckId?: (message: any) => string | number | null;
};
/**
 * 消息序列号配置
 */
export type SequenceStrategy = {
    /** 是否开启本地序列号 (默认: true) */
    enabled?: boolean;
    /** 生成序列号（默认自增） */
    generateSeq?: () => string | number;
    /**
     * 对外发数据加上 seq
     * @example 默认: (seq, data) => ({ seq, payload: data })
     */
    wrapOutbound?: (seq: string | number, data: any) => any;
    /**
     * 解析入站消息的序列号
     */
    extractInboundSeq?: (message: any) => string | number | null;
};
export interface WebSocketConfig {
    /** 最大重连尝试次数 (默认: 10) */
    maxReconnectAttempts?: number;
    /** 初始重连延迟(ms) (默认: 1000) */
    reconnectDelay?: number;
    /** 退避指数 (默认: 1.5) */
    reconnectExponent?: number;
    /** 最大重连延迟(ms) (默认: 30000) */
    maxReconnectDelay?: number;
    /** 连接池大小 (默认: 5) */
    connectionPoolSize?: number;
    /** 最大并行任务数 (默认: 1) */
    maxConcurrent?: number;
    /** 默认消息优先级 (默认: 1) */
    defaultPriority?: number;
    /** 是否启用压缩 (默认: false) */
    enableCompression?: boolean;
    /** 自定义序列化器 */
    serializer?: Serializer;
    /** 消息 ACK 配置 */
    ack?: AckStrategy;
    /** 消息序列号配置 */
    sequence?: SequenceStrategy;
    /** 是否需要心跳 (默认: true) */
    isNeedHeartbeat?: boolean;
    /** 心跳配置 */
    heartbeat?: HeartbeatConfig;
}
export { WebSocketEvent } from '../constants/events';
export interface IWebSocketClient {
    send(data: any, priority?: number): Promise<void>;
    /**
     * 发送消息并等待 ACK
     * - 使用全局或自定义的 ACK 配置
     * - 返回的 Promise 会在收到 ACK、超时或重试失败后结束
     */
    sendWithAck(data: any, priority?: number): Promise<void>;
    /**
     * 获取最后一次入站消息解析到的 seq（需要开启 sequence 并提供 extractInboundSeq）
     * - 常用于“断线/切前台后补拉”：把返回值作为 sinceSeq/afterSeq 之类的参数传给 HTTP 接口
     */
    getLastInboundSeq(): string | number | undefined;
    /**
     * 手动更新最后一次入站 seq
     * - 常用于补拉接口：当你已经把数据同步到最新 seq 后，调用此方法同步到 client
     */
    updateLastInboundSeq(seq: string | number): void;
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
