import type { WebSocketConfig, WebSocketEvent, IWebSocketManager, IWebSocketClient, Serializer } from "./types";
/**
 * 创建 WebSocket 管理器实例
 * @param config 可选配置项
 * @returns WebSocketManager 实例
 *
 * @example
 * ```typescript
 * const manager = createWebSocketManager({
 *   maxReconnectAttempts: 5,
 *   heartbeatInterval: 30000
 * });
 * ```
 */
export declare const createWebSocketManager: (config?: Partial<WebSocketConfig>) => IWebSocketManager;
/**
 * 默认 JSON 序列化器
 */
export declare const JsonSerializer: Serializer;
/**
 * 使用 MessagePack 的序列化器示例（需自行安装依赖）
 *
 * @example
 * ```typescript
 * import { createWebSocketManager } from 'websocket-pro-client';
 * import { encode, decode } from '@msgpack/msgpack';
 *
 * const manager = createWebSocketManager({
 *   serializer: {
 *     serialize: encode,
 *     deserialize: decode
 *   }
 * });
 * ```
 */
export declare const MsgPackSerializer: Serializer;
export type { WebSocketConfig, WebSocketEvent, IWebSocketManager, IWebSocketClient, Serializer, };
export { EventEmitter, WebSocketManager, WebSocketClient } from "./core";
