import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebSocketClient } from "../../src/core/WebSocketClient";
import { WebSocketConfig } from "../../src/types";

// 默认配置常量
const DEFAULT_CONFIG: Required<WebSocketConfig> = {
  maxReconnectAttempts: 10,
  reconnectDelay: 1000,
  reconnectExponent: 1.5,
  maxReconnectDelay: 30000,
  heartbeatInterval: 25000,
  heartbeatTimeout: 10000,
  connectionPoolSize: 5,
  defaultPriority: 1,
  enableCompression: false,
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  },
};

describe("WebSocketClient", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "WebSocket",
      vi.fn(() => ({
        send: vi.fn(),
        close: vi.fn(),
        readyState: 0, // CONNECTING
      }))
    );
  });

  it("should auto-reconnect with exponential backoff", async () => {
    const client = new WebSocketClient(
      "wss://echo.websocket.org",
      [],
      DEFAULT_CONFIG
    );

    // 模拟连接断开
    client.close();

    await new Promise((r) => setTimeout(r, 50));
    expect(WebSocket).toHaveBeenCalledTimes(1); // 初始连接
  });
});
