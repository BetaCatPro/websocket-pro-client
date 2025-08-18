import { WebSocketConfig } from "@/types";

// 默认配置常量
export const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  reconnectExponent: 1.5,
  maxReconnectDelay: 30000,
  connectionPoolSize: 5,
  maxConcurrent: 1,
  defaultPriority: 1,
  enableCompression: false,
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  },
  isNeedHeartbeat: true,
  heartbeat: {
    interval: 25000,
    timeout: 10000,
    message: "PING",
  },
};
