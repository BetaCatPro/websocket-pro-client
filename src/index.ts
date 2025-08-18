import { DEFAULT_CONFIG } from "./config";
import { WebSocketManager } from "./core/WebSocketManager";
import type {
  WebSocketConfig,
  WebSocketEvent,
  IWebSocketManager,
  IWebSocketClient,
  Serializer,
} from "./types";

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
export const createWebSocketManager = (
  config: Partial<WebSocketConfig> = {}
): IWebSocketManager => {
  const mergedConfig: Required<WebSocketConfig> = {
    ...DEFAULT_CONFIG,
    ...config,
    serializer: {
      ...DEFAULT_CONFIG.serializer,
      ...config.serializer,
    },
  };

  return new WebSocketManager(mergedConfig);
};

/**
 * 默认 JSON 序列化器
 */
export const JsonSerializer: Serializer = {
  serialize: JSON.stringify,
  deserialize: JSON.parse,
};

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
export const MsgPackSerializer: Serializer = {
  serialize: (data: any) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  },
  deserialize: (data: any) => {
    throw new Error(
      "MsgPack serializer requires @msgpack/msgpack installation"
    );
  },
};

// 导出所有类型和接口
export type {
  WebSocketConfig,
  WebSocketEvent,
  IWebSocketManager,
  IWebSocketClient,
  Serializer,
};

// 导出核心类（供高级用户使用）
export { EventEmitter, WebSocketManager, WebSocketClient } from "./core";
