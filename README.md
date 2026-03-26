## WebSocket Pro Client

[![npm version](https://img.shields.io/npm/v/websocket-pro-client)](https://www.npmjs.com/package/websocket-pro-client)
[![test coverage](https://img.shields.io/badge/coverage-100%25-success)](https://github.com/BetaCatPro/websocket-pro-client/actions)

面向现代 Web 应用的高性能 WebSocket 客户端：开箱即用的自动重连与心跳保活，灵活可配的 ACK/序列号与主题订阅（支持通配符、自动重订阅），再加上离线队列策略与可观测状态统计，让你的实时通信在弱网、抖动和复杂业务场景下依然稳定、可控、易扩展。

### 特性一览

- 🚀 自动重连 + 指数退避算法
- 💓 心跳检测（支持自定义心跳内容与超时处理）
- 🎯 消息优先级调度 & 最大并发控制
- 📦 连接池管理（同一 url/protocol 只维护一个连接实例）
- 🔄 运行时更新配置（心跳、重连策略等）
- ✅ 内置消息 ACK 机制（默认实现 + 完全可自定义）
- 🔢 消息序列号支持（默认自增，可自定义包装与解析）
- 🧭 消息主题/类型订阅（支持通配符（`order.*`）+ 自动重订阅）
- 📴 离线消息队列
- 📊 运行状态与统计
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
import {
  createWebSocketManager,
  HeartbeatTimerMode,
} from "websocket-pro-client"

// 1. 创建全局 WebSocket 管理器（可配置重连、心跳、ACK 等）
const manager = createWebSocketManager({
  maxReconnectAttempts: 5,
})

// 2. 建立连接（同一 url + protocols 只会创建一个底层连接）
const client = manager.connect("wss://api.example.com")

// 3. 监听消息
client.on("message", (data) => {
  console.log("Received:", data)
})

// 4. 发送消息（不关心 ACK）
client.send({ type: "ping" })
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
  - 监听所有客户端转发上来的事件（包含 `open/message/close/error/reconnect/heartbeat/latency/overMaxReconnectAttempts`），回调中会携带 `{ url, protocols, data }`。

示例：

```ts
import { WebSocketEvent } from "websocket-pro-client"

manager.on(WebSocketEvent.Error, ({ url, data }) => {
  console.error("ws error:", url, data)
})
```

---

### 3. WebSocketClient

`IWebSocketClient` 接口：

```ts
export interface IWebSocketClient {
  send(data: any, priority?: number): Promise<void>
  sendWithAck(data: any, priority?: number): Promise<void>
  getLastInboundSeq(): string | number | undefined
  updateLastInboundSeq(seq: string | number): void
  subscribe(topic: string, listener: (data: any) => void): () => void
  unsubscribe(topic: string, listener?: (data: any) => void): void
  getState(): WebSocketClientState
  getStats(): WebSocketClientStats
  resetStats(options?: ResetStatsOptions): void
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

- **`getLastInboundSeq()`**
  - 获取最后一次入站消息解析到的 `seq`（需要开启 `sequence` 并提供 `extractInboundSeq`）。
  - 常用于“断线/切前台恢复”后的消息补拉：把返回值作为 `sinceSeq/afterSeq` 参数传给你的 HTTP 拉取接口。

- **`updateLastInboundSeq(seq)`**
  - 手动更新最后一次入站 `seq`。
  - 常用于补拉：当你已经把本地数据处理到最新 `seq` 后，同步回 client，避免后续补拉仍使用旧值。

- **`getState()`**
  - 获取当前客户端运行状态（`WebSocketClientState` 枚举）：
    - `WebSocketClientState.Connecting`
    - `WebSocketClientState.Open`
    - `WebSocketClientState.Reconnecting`
    - `WebSocketClientState.Closed`
    - `WebSocketClientState.OverMaxReconnectAttempts`

- **`getStats()`**
  - 获取运行统计信息，用于调试与监控：
    - `sentCount`：发送消息总数
    - `receivedCount`：接收消息总数
    - `errorCount`：错误总数
    - `reconnectScheduledCount`：触发重连调度总数
    - `ackTimeoutCount`：ACK 最终超时次数
    - `reconnectAttempts`：重连尝试次数
    - `pendingAcksCount`：等待 ACK 的数量
    - `messageQueueLength`：离线待发送队列长度
    - `subscribedTopicCount`：订阅主题数量
    - `subscriptionListenerCount`：订阅监听器总数
    - `lastInboundSeq`：最近一次入站 seq
    - `socketReadyState`：底层 WebSocket readyState
    - `lastHeartbeatLatency`：最近一次心跳延迟（ms）
    - `lastErrorAt`：最近一次错误时间戳（ms）
    - `lastCloseCode/lastCloseReason/lastCloseAt`：最近一次关闭信息

- **`resetStats()`**
  - 重置统计指标计数与最近状态字段（如 `sentCount/errorCount/lastErrorAt` 等）。
  - 不会影响连接状态、订阅关系、待 ACK 列表和消息队列。
  - 支持可选参数：
    - `resetCounters`：是否重置计数指标（默认 `true`）
    - `resetLastEvents`：是否重置最近事件字段（默认 `true`）

```ts
type ResetStatsOptions = {
  resetCounters?: boolean
  resetLastEvents?: boolean
}
```

- **`close(code?, reason?)`**
  - 主动关闭当前连接，并清理所有等待中的 ACK。

- **`reconnect()`**
  - 立即重连一次（会重置重连计数和退避延迟）。
  - `close()` 属于主动关闭，不会自动重连；非主动断开（如服务端关闭/网络中断）会按重连策略自动重连。

- **`subscribe(topic, listener)`**
  - 订阅某个 topic 的消息，返回取消订阅函数。
  - topic 支持通配符 `*`：
    - `order.*` 匹配 `order.created` / `order.updated` 等任意后缀
  - 也支持：
    - `?`：匹配任意单个字符（如 `order.updat?d`）
    - `{a,b}`：匹配多个备选（如 `order.{created,updated}`）
  - 默认会通过 `subscription.extractTopic` 从入站消息提取 topic（默认读取 `message.topic`）并分发到对应 listener。
  - 如果配置了 `subscription.buildSubscribeMessage`，会在首次订阅 topic 时发送订阅报文。

- **`unsubscribe(topic, listener?)`**
  - 取消某个 topic 的订阅。
  - 传 `listener` 时仅移除该监听器；不传则移除该 topic 下所有监听器。
  - 如果配置了 `subscription.buildUnsubscribeMessage`，在该 topic 没有监听器后会发送取消订阅报文。

- **`subscribeOnce(topic, listener)`**
  - 订阅某个 topic 的消息，但只触发一次，触发后会自动退订。

- **事件监听**

```ts
import { WebSocketEvent } from "websocket-pro-client"

client.on(WebSocketEvent.Open, () => {
  console.log("ws open")
})

client.on(WebSocketEvent.Message, (data) => {
  console.log("message:", data)
})

client.on(WebSocketEvent.Close, (event) => {
  console.log("closed:", event)
})

client.on(WebSocketEvent.Error, (err) => {
  console.error("ws error:", err)
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
  // 主题订阅
  subscription?: SubscriptionStrategy

  // 离线消息队列
  offlineQueue?: OfflineQueueConfig
}
```

> `createWebSocketManager` 会将配置与默认值做**深度合并**。例如仅传 `ack.timeout`，`ack.enabled/generateId/wrapOutbound/extractAckId` 等默认项仍会保留。

### 1. 心跳配置 HeartbeatConfig

```ts
export type HeartbeatConfig = {
  interval?: number // 心跳间隔(ms)，默认 25000
  timeout?: number // 心跳超时(ms)，默认 45000
  pingMessage?: any // 用于发送 PING 的消息（默认 "PING"）
  getPing?: () => any // 自定义生成 PING（优先级高于 pingMessage)
  pongMessage?: any // 用于识别服务端 PONG 的消息（默认 "PONG"）
  isPong?: (raw: any, parsed: any) => boolean // 自定义识别 PONG（优先级高于 pongMessage）
  timerMode?: "auto" | "main" | "worker" // 心跳计时器模式，默认 auto
  onTimeout?: () => void // 心跳超时时的自定义回调
}
```

默认情况下，客户端会周期性发送心跳消息，并在超时时自动触发重连。

#### 浏览器后台与心跳稳定性

当页面被最小化/切到后台时，浏览器可能会对 `setTimeout/setInterval` **降频或合并触发**，导致定时任务不再“准点”。本库的心跳实现会用：

- **递归 `setTimeout` + 漂移修正**：避免 `setInterval` 在后台堆积触发带来的状态错乱
- **基于真实时间差的超时判断**（`Date.now()`）：即使回调延迟，也不会把“应该超时”的连接误当成健康连接

#### timerMode（可选：Web Worker 计时）

为了提升后台计时稳定性，你可以让心跳的计时器运行在 **Web Worker** 中（部分浏览器/环境可能不支持，库会自动回退到主线程计时器）。

- **`auto`（默认）**：优先使用 Worker，不可用则回退主线程
- **`main`**：强制主线程
- **`worker`**：强制 Worker（不可用仍会回退主线程，并输出 warn）

#### PONG 识别（兼容自定义协议）

默认情况下库会把 **`"PONG"`** 识别为心跳响应并调用 `recordPong()`。如果你的服务端返回的不是字符串 `"PONG"`（例如返回 JSON），可以通过下面两种方式配置：

- **`pongMessage`**：简单场景，配置一个值即可（会同时与 raw/parsed 做严格相等判断）
- **`isPong(raw, parsed)`**：复杂场景，自行判断是否为 PONG（优先级更高）

示例（服务端返回 `{ type: 'pong' }`）：

```ts
const manager = createWebSocketManager({
  heartbeat: {
    getPing: () => ({ type: "ping" }),
    isPong: (_raw, parsed) => parsed && parsed.type === "pong",
  },
})
```

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
      msg && msg.type === "ACK" && msg.msgId != null ? msg.msgId : null,
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

### 4. 主题订阅配置 SubscriptionStrategy

```ts
export type SubscriptionStrategy = {
  extractTopic?: (message: any) => string | null
  buildSubscribeMessage?: (topic: string) => any
  buildUnsubscribeMessage?: (topic: string) => any
  autoResubscribe?: boolean
}
```

默认实现：

- `extractTopic`: 读取 `message.topic`（字符串）
- `autoResubscribe: true`
- 不会默认发送订阅/取消订阅报文（需自行提供 `buildSubscribeMessage/buildUnsubscribeMessage`）

示例：

```ts
const manager = createWebSocketManager({
  subscription: {
    buildSubscribeMessage: (topic) => ({ type: "SUBSCRIBE", topic }),
    buildUnsubscribeMessage: (topic) => ({ type: "UNSUBSCRIBE", topic }),
    autoResubscribe: true,
  },
})

const client = manager.connect("wss://api.example.com")
const dispose = client.subscribe("order.updated", (msg) => {
  console.log("order event:", msg)
})

// 也可以主动取消
dispose()
```

### 5. 离线消息队列配置 OfflineQueueConfig

```ts
export type OfflineQueueConfig = {
  enabled?: boolean
  maxQueueSize?: number
  dropStrategy?: OfflineQueueDropStrategy
  messageTTL?: number
}
```

当底层 `WebSocket` 还没进入 `OPEN` 状态时（断线/重连中/初始化阶段），`send/sendWithAck` 会把消息暂存到离线队列；当连接恢复后会按队列顺序发送。

队列行为：

- `maxQueueSize`：队列容量上限（默认 `1000`），超过后按 `dropStrategy` 处理
- `dropStrategy`：
  - `OfflineQueueDropStrategy.DropOldest`：丢弃队列最老消息，保留新消息
  - `OfflineQueueDropStrategy.DropNewest`：丢弃新消息
  - `OfflineQueueDropStrategy.Reject`：丢弃并立即 reject 新消息 Promise
- `messageTTL`（毫秒）：过期消息会被移除并 reject（错误码 `OfflineQueueTTLExpired`）

---

## 使用 ACK 与序列号的完整示例

```ts
import { createWebSocketManager, WebSocketEvent } from "websocket-pro-client"

const manager = createWebSocketManager({
  ack: {
    enabled: true,
    timeout: 3000,
    maxRetries: 1,
  },
})

const client = manager.connect("wss://api.example.com")

client.on(WebSocketEvent.Open, async () => {
  // 发送一条不需要 ACK 的消息
  await client.send({ type: "ping" })

  // 发送一条需要 ACK 的消息
  try {
    await client.sendWithAck({ type: "update", payload: { id: 1 } })
    console.log("update confirmed by server")
  } catch (e) {
    console.error("update failed (no ACK):", e)
  }
})

client.on(WebSocketEvent.Message, (msg) => {
  // msg 是反序列化后的对象，例如:
  // { seq, payload: { ... } } 或根据你自定义的包装形态
  console.log("inbound message:", msg)
})
```

---

## 与“补拉接口”配合示例（推荐）

浏览器在切到后台、网络波动等场景可能出现 WebSocket 断开/重连。推荐结合服务端的消息存储能力，提供一个补拉接口（例如 `GET /messages?sinceSeq=xxx`）。

```ts
import { WebSocketEvent, createWebSocketManager } from "websocket-pro-client"

const manager = createWebSocketManager({
  heartbeat: {
    timerMode: "auto",
  },
})

const client = manager.connect("wss://api.example.com")

async function fetchMissedMessages(sinceSeq?: string | number) {
  // 伪代码：替换为你的请求库
  const res = await fetch(`/messages?sinceSeq=${sinceSeq ?? ""}`)
  return res.json()
}

client.on(WebSocketEvent.Open, async () => {
  const sinceSeq = client.getLastInboundSeq()
  const missed = await fetchMissedMessages(sinceSeq)
  console.log("missed messages:", missed)
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
