## WebSocket Pro Client

[![npm version](https://img.shields.io/npm/v/websocket-pro-client)](https://www.npmjs.com/package/websocket-pro-client)
[![test coverage](https://img.shields.io/badge/coverage-100%25-success)](https://github.com/BetaCatPro/websocket-pro-client/actions)

高性能 WebSocket 客户端，专为现代 Web 应用设计，内置自动重连、心跳、消息优先级调度、连接池管理，以及**可配置的消息 ACK 与序列号机制**。

### 特性一览

- 🚀 自动重连 + 指数退避算法
- 💓 心跳检测（支持自定义心跳内容与超时处理）
- 🎯 消息优先级调度 & 最大并发控制
- 📦 连接池管理（同一 url/protocol 只维护一个连接实例）
- 🔄 运行时更新配置（心跳、重连策略等）
- ✅ 内置消息 ACK 机制（默认实现 + 完全可自定义）
- 🔢 消息序列号支持（默认自增，可自定义包装与解析）
- 🔍 完整 TypeScript 类型定义

---

## 安装

```bash
npm install websocket-pro-client
# 或
yarn add websocket-pro-client
```

---

## 快速开始

```typescript
import { createWebSocketManager } from 'websocket-pro-client'

// 1. 创建全局 WebSocket 管理器（可配置重连、心跳、ACK 等）
const manager = createWebSocketManager({
  maxReconnectAttempts: 5,
})

// 2. 建立连接（同一 url + protocols 只会创建一个底层连接）
const client = manager.connect('wss://api.example.com')

// 3. 监听消息
client.on('message', (data) => {
  console.log('Received:', data)
})

// 4. 发送消息（不关心 ACK）
client.send({ type: 'ping' })
```

---

## API 说明

### 1. 顶层方法

- **`createWebSocketManager(config?: Partial<WebSocketConfig>): IWebSocketManager`**
  - 创建一个 WebSocket 连接管理器。
  - 内部会将传入的配置与库内的 `DEFAULT_CONFIG` 深度合并。

- **`JsonSerializer / MsgPackSerializer`**
  - `JsonSerializer`: 默认使用 `JSON.stringify/JSON.parse` 的序列化器。
  - `MsgPackSerializer`: MessagePack 示例（需要自行安装 `@msgpack/msgpack` 后替换实现）。

---

### 2. WebSocketManager

`IWebSocketManager` 接口：

```ts
export interface IWebSocketManager {
  connect(url: string, protocols?: string[]): IWebSocketClient
  closeAll(code?: number, reason?: string): void
  on(event: WebSocketEvent, listener: (data: any) => void): void
}
```

- **`connect(url, protocols?)`**
  - 返回一个 `IWebSocketClient` 实例。
  - 同一 `url + protocols` 会复用同一个底层连接。
- **`closeAll(code?, reason?)`**
  - 关闭当前 manager 管理的所有连接。
- **`on(event, listener)`**
  - 监听所有客户端转发上来的事件（`open/message/close/error` 等），回调中会携带 `{ url, protocols, data }`。

示例：

```ts
import { WebSocketEvent } from 'websocket-pro-client'

manager.on(WebSocketEvent.Error, ({ url, data }) => {
  console.error('ws error:', url, data)
})
```

---

### 3. WebSocketClient

`IWebSocketClient` 接口：

```ts
export interface IWebSocketClient {
  send(data: any, priority?: number): Promise<void>
  sendWithAck(data: any, priority?: number): Promise<void>
  close(code?: number, reason?: string): void
  reconnect(): void
  on(event: WebSocketEvent, listener: (data: any) => void): void
  off(event: WebSocketEvent, listener: (data: any) => void): void
}
```

- **`send(data, priority?)`**
  - 发送一条消息，不等待 ACK。
  - 返回的 Promise 仅表示“客户端已成功发送到 WebSocket”，**不代表服务端处理成功**。

- **`sendWithAck(data, priority?)`**
  - 发送一条消息，并基于全局 `ack` 配置等待服务端 ACK。
  - 默认行为：
    - 发送的数据会被包装成：`{ id, payload: { seq, payload: 原始data } }`
    - 要求服务端在处理完成后，发送一条包含 `ackId` 字段的消息（例如 `{ ackId: id }`），表示已确认。
    - 支持超时与自动重试（由 `ack.timeout` 和 `ack.maxRetries` 控制）。

- **`close(code?, reason?)`**
  - 主动关闭当前连接，并清理所有等待中的 ACK。

- **`reconnect()`**
  - 立即重连一次（会重置重连计数和退避延迟）。

- **事件监听**

```ts
import { WebSocketEvent } from 'websocket-pro-client'

client.on(WebSocketEvent.Open, () => {
  console.log('ws open')
})

client.on(WebSocketEvent.Message, (data) => {
  console.log('message:', data)
})

client.on(WebSocketEvent.Close, (event) => {
  console.log('closed:', event)
})

client.on(WebSocketEvent.Error, (err) => {
  console.error('ws error:', err)
})
```

---

## 配置说明（WebSocketConfig）

```ts
export interface WebSocketConfig {
  // 重连相关
  maxReconnectAttempts?: number
  reconnectDelay?: number
  reconnectExponent?: number
  maxReconnectDelay?: number

  // 任务调度 & 连接池
  connectionPoolSize?: number
  maxConcurrent?: number
  defaultPriority?: number

  // 序列化
  enableCompression?: boolean
  serializer?: Serializer

  // 心跳
  isNeedHeartbeat?: boolean
  heartbeat?: HeartbeatConfig

  // 消息 ACK
  ack?: AckStrategy

  // 消息序列号
  sequence?: SequenceStrategy
}
```

### 1. 心跳配置 HeartbeatConfig

```ts
export type HeartbeatConfig = {
  interval?: number      // 心跳间隔(ms)，默认 25000
  timeout?: number       // 心跳超时(ms)，默认 10000
  message?: string       // 心跳消息内容，默认 "PING"
  onTimeout?: () => void // 心跳超时时的自定义回调
}
```

默认情况下，客户端会周期性发送心跳消息，并在超时时自动触发重连。

### 2. 消息 ACK 配置 AckStrategy

```ts
export type AckStrategy = {
  enabled?: boolean
  timeout?: number
  maxRetries?: number
  generateId?: () => string | number
  wrapOutbound?: (id: string | number, data: any) => any
  extractAckId?: (message: any) => string | number | null
}
```

默认实现（不配置时）：

- `enabled: true`
- `timeout: 5000`
- `maxRetries: 2`
- `generateId`: 使用浏览器 `window` 上的自增计数。
- `wrapOutbound`: `({ id, payload })`
- `extractAckId`: 从 `message.ackId` 中提取 ACK 对应的 ID。

> 如需和现有服务端协议对齐，只需要重写 `wrapOutbound` 和 `extractAckId` 即可。

#### 自定义 ACK 协议示例

后端规定：

- 出站：`{ msgId, body }`
- ACK 消息：`{ type: 'ACK', msgId }`

对应配置：

```ts
const manager = createWebSocketManager({
  ack: {
    enabled: true,
    wrapOutbound: (id, data) => ({ msgId: id, body: data }),
    extractAckId: (msg) =>
      msg && msg.type === 'ACK' && msg.msgId != null ? msg.msgId : null,
  },
})
```

### 3. 消息序列号配置 SequenceStrategy

```ts
export type SequenceStrategy = {
  enabled?: boolean
  generateSeq?: () => string | number
  wrapOutbound?: (seq: string | number, data: any) => any
  extractInboundSeq?: (message: any) => string | number | null
}
```

默认实现：

- `enabled: true`
- `generateSeq`: 使用浏览器 `window` 上的自增计数。
- `wrapOutbound`: `({ seq, payload })`
- `extractInboundSeq`: 从 `message.seq` 中提取序列号。

> 库内部只负责“生成/包装/解析”序列号，不做强制的乱序丢弃；你可以在 `message` 监听回调中结合 `seq` 做业务上的顺序控制。

---

## 使用 ACK 与序列号的完整示例

```ts
import {
  createWebSocketManager,
  WebSocketEvent,
} from 'websocket-pro-client'

const manager = createWebSocketManager({
  ack: {
    enabled: true,
    timeout: 3000,
    maxRetries: 1,
  },
})

const client = manager.connect('wss://api.example.com')

client.on(WebSocketEvent.Open, async () => {
  // 发送一条不需要 ACK 的消息
  await client.send({ type: 'ping' })

  // 发送一条需要 ACK 的消息
  try {
    await client.sendWithAck({ type: 'update', payload: { id: 1 } })
    console.log('update confirmed by server')
  } catch (e) {
    console.error('update failed (no ACK):', e)
  }
})

client.on(WebSocketEvent.Message, (msg) => {
  // msg 是反序列化后的对象，例如:
  // { seq, payload: { ... } } 或根据你自定义的包装形态
  console.log('inbound message:', msg)
})
```

---

## 开发调试

```bash
# 启动测试
npm test

# 构建库
npm run build

# 运行 demo
npm run demo
```

---

## 贡献指南

1. Fork 仓库
2. 创建分支 (`git checkout -b dev/feature/fix-xxx`)
3. 提交更改 (`git commit -am 'feat/fix xxx'`)
4. 推送到分支 (`git push origin dev/feature/fix-xxx`)
5. 创建 Pull Request

---

## 许可证

MIT © 2023 BetaCatPro
