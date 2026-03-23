import { WebSocketConfig } from "../types"
import { HeartbeatMessage, HeartbeatTimerMode } from "../constants/heartbeat"

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
  ack: {
    enabled: true,
    timeout: 5000,
    maxRetries: 2,
    generateId: () => {
      // 简单的自增 ID，足够覆盖客户端生命周期
      // 注意：这里只在单实例内保证唯一
      if (!(window as any).__ws_pro_client_ack_id__) {
        ;(window as any).__ws_pro_client_ack_id__ = 1
      }
      const current = (window as any).__ws_pro_client_ack_id__ as number
      ;(window as any).__ws_pro_client_ack_id__ = current + 1
      return current
    },
    wrapOutbound: (id, data) => ({
      id,
      payload: data,
    }),
    extractAckId: (msg) =>
      msg && typeof msg === "object" && "ackId" in msg
        ? (msg as any).ackId
        : null,
  },
  sequence: {
    enabled: true,
    generateSeq: () => {
      if (!(window as any).__ws_pro_client_seq__) {
        ;(window as any).__ws_pro_client_seq__ = 1
      }
      const current = (window as any).__ws_pro_client_seq__ as number
      ;(window as any).__ws_pro_client_seq__ = current + 1
      return current
    },
    wrapOutbound: (seq, data) => ({
      seq,
      payload: data,
    }),
    extractInboundSeq: (message: any) => {
      if (message && typeof message === "object" && "seq" in message) {
        return (message as any).seq
      }
      return null
    },
  },
  subscription: {
    extractTopic: (message: any) => {
      if (
        message &&
        typeof message === "object" &&
        "topic" in message &&
        typeof (message as any).topic === "string"
      ) {
        return (message as any).topic
      }
      return null
    },
    autoResubscribe: true,
  },
  isNeedHeartbeat: true,
  heartbeat: {
    interval: 25000,
    timeout: 45000,
    pingMessage: HeartbeatMessage.Ping,
    pongMessage: HeartbeatMessage.Pong,
    timerMode: HeartbeatTimerMode.Auto,
  },
}
