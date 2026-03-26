import { Heartbeat } from "./Heartbeat"
import { TaskScheduler } from "./TaskScheduler"
import { EventEmitter } from "./EventEmitter"
import {
  ResetStatsOptions,
  WebSocketClientState,
  WebSocketConfig,
  WebSocketEvent,
} from "../types"
import { HeartbeatEvent, HeartbeatMessage } from "../constants/heartbeat"
import { DEFAULT_CONFIG } from "../config"
import { deepMerge, isEqual, matchTopicPattern } from "../utils"
import { WebSocketClientError, WebSocketErrorCode } from "../constants/errors"
import { getLogger } from "../logger"

export class WebSocketClient extends EventEmitter {
  private currentConfig: Required<WebSocketConfig>
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private isManualClose = false
  private isOverMaxReconnectAttempts = false
  private readonly messageQueue: Array<{
    data: any
    priority: number
    needAck: boolean
    resolve: () => void
    reject: (err: Error) => void
  }> = []
  private heartbeat?: Heartbeat
  private readonly scheduler: TaskScheduler
  private readonly topicListeners = new Map<string, Set<(data: any) => void>>()
  private lastHeartbeatLatency?: number
  private lastErrorAt?: number
  private lastCloseCode?: number
  private lastCloseReason?: string
  private lastCloseAt?: number
  private sentCount = 0
  private receivedCount = 0
  private errorCount = 0
  private reconnectScheduledCount = 0
  private ackTimeoutCount = 0

  // 等待 ACK 的消息：id -> { resolve, reject, timer, retries, rawData }
  private readonly pendingAcks = new Map<
    string | number,
    {
      resolve: () => void
      reject: (err: Error) => void
      timer: ReturnType<typeof setTimeout>
      retries: number
      rawData: any
      priority: number
    }
  >()

  // 可选：记录最近一次入站 seq，方便外部按需做顺序控制
  private lastInboundSeq?: string | number

  // 解决配置更新的线程安全与竞态条件
  private isUpdatingConfig = false
  private configQueue: WebSocketConfig[] = []
  constructor(
    private readonly url: string,
    private readonly protocols: string[],
    private config: Required<WebSocketConfig>,
  ) {
    super()
    this.currentConfig = deepMerge(DEFAULT_CONFIG, this.config)
    this.initHeartbeat()
    this.scheduler = new TaskScheduler(
      this.currentConfig.maxConcurrent,
      (err) => this.emit(WebSocketEvent.Error, err),
    )
    this.connect()
  }

  // 初始化心跳
  private initHeartbeat() {
    if (!this.currentConfig.isNeedHeartbeat) return
    this.heartbeat = new Heartbeat(this.currentConfig.heartbeat, () => {
      const hbCfg = this.currentConfig.heartbeat
      const ping =
        typeof hbCfg?.getPing === "function"
          ? hbCfg.getPing()
          : (hbCfg?.pingMessage ?? HeartbeatMessage.Ping)
      // 心跳走独立通道，避免被业务发送/ACK等待阻塞
      this.sendHeartbeat(ping)
    })

    this.heartbeat.on(HeartbeatEvent.Timeout, () => {
      getLogger().warn("Heartbeat timeout, triggering reconnect...")
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.close(1000, "heartbeat timeout")
      }
      this.scheduleReconnect()
    })

    this.heartbeat.on(HeartbeatEvent.Pong, (latency) => {
      this.emit(WebSocketEvent.Heartbeat, latency)
      this.emit(WebSocketEvent.Latency, latency)
      this.lastHeartbeatLatency = latency
    })
  }

  private connect(): void {
    this.isManualClose = false
    this.socket = new WebSocket(this.url, this.protocols)
    this.socket.binaryType = "arraybuffer"

    this.socket.onopen = (event) => {
      const wasReconnecting = this.reconnectAttempts > 0
      this.reconnectAttempts = 0
      this.isOverMaxReconnectAttempts = false
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = undefined
      this.heartbeat && this.heartbeat.start()
      this.flushMessageQueue()
      if (wasReconnecting) {
        this.reSyncSubscriptions()
        this.emit(WebSocketEvent.Reconnect)
      }
      this.emit(WebSocketEvent.Open, event)
    }

    this.socket.onmessage = (event) => {
      this.receivedCount += 1
      const raw = event.data
      let parsed: any = raw

      // 使用全局 serializer 做解析，供 ACK / 序列号使用
      try {
        parsed = this.currentConfig.serializer.deserialize(raw)
      } catch {
        // 反序列化失败时，不影响原始事件分发
        parsed = raw
      }

      // 0. 识别心跳 PONG（允许外部自定义）
      const hbCfg = this.currentConfig.heartbeat
      const isPong =
        typeof hbCfg?.isPong === "function"
          ? hbCfg.isPong(raw, parsed)
          : hbCfg?.pongMessage !== undefined &&
            (raw === hbCfg.pongMessage || parsed === hbCfg.pongMessage)

      if (isPong) {
        this.heartbeat && this.heartbeat.recordPong()
        return
      }

      // 1. 处理 ACK
      const ackCfg = this.currentConfig.ack
      if (ackCfg?.enabled && typeof ackCfg.extractAckId === "function") {
        const ackId = ackCfg.extractAckId(parsed)
        if (ackId !== null && ackId !== undefined) {
          const pending = this.pendingAcks.get(ackId)
          if (pending) {
            clearTimeout(pending.timer)
            this.pendingAcks.delete(ackId)
            pending.resolve()
            return
          }
        }
      }

      // 2. 处理序列号（只记录，具体顺序控制交给上层）
      const seqCfg = this.currentConfig.sequence
      if (seqCfg?.enabled && typeof seqCfg.extractInboundSeq === "function") {
        const seq = seqCfg.extractInboundSeq(parsed)
        if (seq !== null && seq !== undefined) {
          this.lastInboundSeq = seq
        }
      }

      // 3. 向外仍然分发“解析后”的数据，保持易用
      this.emit(WebSocketEvent.Message, parsed)
      this.dispatchSubscribedMessage(parsed)
    }

    this.socket.onclose = (event) => {
      this.heartbeat && this.heartbeat.stop()
      this.lastCloseCode = event.code
      this.lastCloseReason = event.reason
      this.lastCloseAt = Date.now()
      this.emit(WebSocketEvent.Close, event)
      if (!this.isManualClose) {
        this.scheduleReconnect()
      }
    }

    this.socket.onerror = (event) => {
      this.heartbeat && this.heartbeat.stop()
      this.emit(WebSocketEvent.Error, event)
      this.errorCount += 1
      this.lastErrorAt = Date.now()
      this.scheduleReconnect()
    }
  }

  private sendRaw(data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data)
      this.sentCount += 1
    }
  }

  private dispatchSubscribedMessage(parsed: any): void {
    const subscriptionCfg = this.currentConfig.subscription
    const topic =
      typeof subscriptionCfg?.extractTopic === "function"
        ? subscriptionCfg.extractTopic(parsed)
        : null

    if (!topic) return
    if (this.topicListeners.size === 0) return

    this.topicListeners.forEach((listeners, pattern) => {
      if (!matchTopicPattern(pattern, topic)) return

      listeners.forEach((listener) => {
        try {
          listener(parsed)
        } catch (err) {
          this.emit(WebSocketEvent.Error, err as Error)
        }
      })
    })
  }

  private reSyncSubscriptions(): void {
    const subscriptionCfg = this.currentConfig.subscription
    if (!subscriptionCfg?.autoResubscribe) return
    if (typeof subscriptionCfg.buildSubscribeMessage !== "function") return

    this.topicListeners.forEach((_listeners, pattern) => {
      const subscribeMessage = subscriptionCfg.buildSubscribeMessage?.(pattern)
      if (subscribeMessage === undefined) return
      try {
        const payload =
          this.currentConfig.serializer.serialize(subscribeMessage)
        this.sendRaw(payload)
      } catch (err) {
        this.emit(WebSocketEvent.Error, err as Error)
      }
    })
  }

  /**
   * 心跳专用发送通道：
   * - 绕过 TaskScheduler（不占用并发槽位）
   * - 不参与 ACK / 序列号包装（保持尽可能轻量）
   */
  private sendHeartbeat(ping: any): void {
    if (this.socket?.readyState !== WebSocket.OPEN) return
    try {
      const payload = this.currentConfig.serializer.serialize(ping)
      this.sendRaw(payload)
    } catch (err) {
      // 心跳发送失败只作为 error 事件抛出，不影响业务队列
      this.emit(WebSocketEvent.Error, err as Error)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
      this.isOverMaxReconnectAttempts = true
      this.emit(WebSocketEvent.OverMaxReconnectAttempts)
      return
    }

    const delay = Math.min(
      this.currentConfig.reconnectDelay *
        Math.pow(this.currentConfig.reconnectExponent, this.reconnectAttempts),
      this.currentConfig.maxReconnectDelay,
    )

    // 添加随机抖动（避免集群同时重连的"惊群效应"）
    const jitterRatio = 0.2 // ±20%的随机波动
    const jitter = delay * jitterRatio * (Math.random() * 2 - 1) // [-0.2,0.2]范围
    const actualDelay = Math.max(1000, delay + jitter) // 保证至少1秒

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined
      this.reconnectAttempts++
      this.emit(WebSocketEvent.Reconnect, {
        attempt: this.reconnectAttempts,
        delay: actualDelay,
      })
      this.connect()
    }, actualDelay)
    this.reconnectScheduledCount += 1
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const { data, priority, needAck, resolve, reject } =
        this.messageQueue.shift()!
      this.sendInternal(data, priority, needAck).then(resolve).catch(reject)
    }
  }

  private sendInternal(
    data: any,
    priority: number,
    needAck: boolean,
  ): Promise<void> {
    if (this.socket?.readyState === WebSocket.OPEN) {
      const ackCfg = this.currentConfig.ack

      // ACK 等待 Promise 与“发送任务”解耦，避免占用 scheduler 并发槽位
      let ackId: string | number | null = null
      let resolveAck: (() => void) | undefined
      let rejectAck: ((err: Error) => void) | undefined

      const ackPromise = needAck
        ? new Promise<void>((resolve, reject) => {
            resolveAck = resolve
            rejectAck = reject
          })
        : undefined

      const sendPromise = this.scheduler.add(async () => {
        let outbound = data

        // 1. 序列号包装
        const seqCfg = this.currentConfig.sequence
        if (seqCfg?.enabled && typeof seqCfg.wrapOutbound === "function") {
          const seq = seqCfg.generateSeq?.()
          if (seq !== undefined) {
            outbound = seqCfg.wrapOutbound(seq, outbound)
          }
        }

        // 2. ACK 包装（仅包装；等待由 ackPromise 处理）
        if (needAck && ackCfg?.enabled) {
          const id = ackCfg.generateId?.()
          if (
            id !== undefined &&
            id !== null &&
            typeof ackCfg.wrapOutbound === "function"
          ) {
            ackId = id
            outbound = ackCfg.wrapOutbound(id, outbound)
          }
        }

        const payload = this.currentConfig.serializer.serialize(outbound)
        this.sendRaw(payload)

        // 3. 注册 pending ack（发送完成后立即返回，释放并发槽位）
        if (!needAck || !ackCfg?.enabled || ackId === null) return

        const timeout = ackCfg.timeout ?? 5000
        this.pendingAcks.set(ackId, {
          resolve: () => resolveAck?.(),
          reject: (err: Error) => rejectAck?.(err),
          retries: 0,
          rawData: data,
          priority,
          timer: setTimeout(() => {
            this.handleAckTimeout(ackId as string | number)
          }, timeout),
        })
      }, priority)

      if (!needAck) return sendPromise

      return sendPromise
        .catch((err) => {
          // 发送阶段失败：同步失败 ACK 等待，并避免泄漏 pending 记录
          if (ackId !== null) {
            const entry = this.pendingAcks.get(ackId)
            if (entry) {
              clearTimeout(entry.timer)
              this.pendingAcks.delete(ackId)
            }
          }
          rejectAck?.(err as Error)
          throw err
        })
        .then(() => {
          // 未成功生成 ack id：等同普通发送
          if (!ackCfg?.enabled || ackId === null || !ackPromise) return
          return ackPromise
        })
    }

    // 连接未就绪：入队，等待连接建立后统一发送
    return new Promise((resolve, reject) => {
      this.messageQueue.push({ data, priority, needAck, resolve, reject })
    })
  }

  private handleAckTimeout(id: string | number): void {
    const ackCfg = this.currentConfig.ack
    const entry = this.pendingAcks.get(id)

    if (!entry || !ackCfg?.enabled) {
      if (entry) {
        this.pendingAcks.delete(id)
        entry.reject(new WebSocketClientError(WebSocketErrorCode.AckTimeout))
      }
      return
    }

    const timeout = ackCfg.timeout ?? 5000
    const maxRetries = ackCfg.maxRetries ?? 0

    if (entry.retries < maxRetries) {
      entry.retries += 1
      // 重新发送原始数据，但不再重新挂 ACK 记录
      this.sendInternal(entry.rawData, entry.priority, false).catch(
        entry.reject,
      )

      entry.timer = setTimeout(() => {
        this.handleAckTimeout(id)
      }, timeout)
    } else {
      this.pendingAcks.delete(id)
      this.ackTimeoutCount += 1
      entry.reject(new WebSocketClientError(WebSocketErrorCode.AckMaxRetries))
    }
  }

  send(
    data: any,
    priority: number = this.currentConfig.defaultPriority,
  ): Promise<void> {
    return this.sendInternal(data, priority, false)
  }

  // 发送并等待 ACK
  sendWithAck(
    data: any,
    priority: number = this.currentConfig.defaultPriority,
  ): Promise<void> {
    return this.sendInternal(data, priority, true)
  }

  getLastInboundSeq(): string | number | undefined {
    return this.lastInboundSeq
  }

  updateLastInboundSeq(seq: string | number): void {
    this.lastInboundSeq = seq
  }

  getState() {
    const readyState = this.socket?.readyState ?? null

    if (this.isOverMaxReconnectAttempts)
      return WebSocketClientState.OverMaxReconnectAttempts
    if (this.reconnectTimer) return WebSocketClientState.Reconnecting
    if (readyState === WebSocket.OPEN) return WebSocketClientState.Open
    if (readyState === WebSocket.CONNECTING)
      return WebSocketClientState.Connecting
    return WebSocketClientState.Closed
  }

  getStats() {
    let subscriptionListenerCount = 0
    this.topicListeners.forEach((listeners) => {
      subscriptionListenerCount += listeners.size
    })

    return {
      sentCount: this.sentCount,
      receivedCount: this.receivedCount,
      errorCount: this.errorCount,
      reconnectScheduledCount: this.reconnectScheduledCount,
      ackTimeoutCount: this.ackTimeoutCount,
      reconnectAttempts: this.reconnectAttempts,
      pendingAcksCount: this.pendingAcks.size,
      messageQueueLength: this.messageQueue.length,
      subscribedTopicCount: this.topicListeners.size,
      subscriptionListenerCount,
      lastInboundSeq: this.lastInboundSeq,
      socketReadyState: this.socket?.readyState ?? null,
      lastHeartbeatLatency: this.lastHeartbeatLatency,
      lastErrorAt: this.lastErrorAt,
      lastCloseCode: this.lastCloseCode,
      lastCloseReason: this.lastCloseReason,
      lastCloseAt: this.lastCloseAt,
    }
  }

  resetStats(options: ResetStatsOptions = {}): void {
    const { resetCounters = true, resetLastEvents = true } = options

    if (resetCounters) {
      this.sentCount = 0
      this.receivedCount = 0
      this.errorCount = 0
      this.reconnectScheduledCount = 0
      this.ackTimeoutCount = 0
    }

    if (resetLastEvents) {
      this.lastHeartbeatLatency = undefined
      this.lastErrorAt = undefined
      this.lastCloseCode = undefined
      this.lastCloseReason = undefined
      this.lastCloseAt = undefined
    }
  }

  subscribe(topic: string, listener: (data: any) => void): () => void
  subscribe(topics: string[], listener: (data: any) => void): () => void
  subscribe(
    topicOrTopics: string | string[],
    listener: (data: any) => void,
  ): () => void {
    if (Array.isArray(topicOrTopics)) {
      const disposers = topicOrTopics
        .filter(Boolean)
        .map((t) => this.subscribe(t, listener))
      return () => disposers.forEach((d) => d())
    }

    const topic = topicOrTopics
    if (!topic) return () => {}

    if (!this.topicListeners.has(topic)) {
      this.topicListeners.set(topic, new Set())
      const subscribeMessage =
        this.currentConfig.subscription?.buildSubscribeMessage?.(topic)
      if (subscribeMessage !== undefined) {
        this.send(subscribeMessage).catch((err) => {
          this.emit(WebSocketEvent.Error, err as Error)
        })
      }
    }

    this.topicListeners.get(topic)!.add(listener)
    return () => this.unsubscribe(topic, listener)
  }

  subscribeOnce(topic: string, listener: (data: any) => void): () => void {
    let disposed = false

    const onceListener = (data: any) => {
      if (disposed) return
      disposed = true

      try {
        listener(data)
      } finally {
        this.unsubscribe(topic, onceListener)
      }
    }

    this.subscribe(topic, onceListener)
    return () => {
      if (disposed) return
      disposed = true
      this.unsubscribe(topic, onceListener)
    }
  }

  unsubscribe(topic: string, listener?: (data: any) => void): void
  unsubscribe(topics: string[], listener?: (data: any) => void): void
  unsubscribe(
    topicOrTopics: string | string[],
    listener?: (data: any) => void,
  ): void {
    if (Array.isArray(topicOrTopics)) {
      topicOrTopics.filter(Boolean).forEach((t) => {
        this.unsubscribe(t, listener)
      })
      return
    }

    const topic = topicOrTopics
    const listeners = this.topicListeners.get(topic)
    if (!listeners) return

    if (listener) {
      listeners.delete(listener)
    } else {
      listeners.clear()
    }

    if (listeners.size > 0) return
    this.topicListeners.delete(topic)

    const unsubscribeMessage =
      this.currentConfig.subscription?.buildUnsubscribeMessage?.(topic)
    if (unsubscribeMessage === undefined) return
    this.send(unsubscribeMessage).catch((err) => {
      this.emit(WebSocketEvent.Error, err as Error)
    })
  }

  close(code?: number, reason?: string): void {
    this.isManualClose = true
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.heartbeat && this.heartbeat.stop()
    // 关闭时清空所有等待中的 ACK，避免 Promise 永远不结束
    this.pendingAcks.forEach((entry, id) => {
      clearTimeout(entry.timer)
      entry.reject(new WebSocketClientError(WebSocketErrorCode.ClosedBeforeAck))
      this.pendingAcks.delete(id)
    })
    this.socket?.close(code, reason)
    this.socket = null
  }

  reconnect(): void {
    clearTimeout(this.reconnectTimer)
    this.reconnectTimer = undefined
    this.reconnectAttempts = 0
    this.isOverMaxReconnectAttempts = false
    this.close()
    this.isManualClose = false
    this.connect()
  }

  // 配置更新方法
  async updateConfig(newConfig: WebSocketConfig) {
    this.configQueue.push(newConfig)
    if (this.isUpdatingConfig) return

    this.isUpdatingConfig = true
    while (this.configQueue.length > 0) {
      const config = this.configQueue.shift()!
      await this.applyConfigSafely(config)
    }
    this.isUpdatingConfig = false
  }

  private applyConfigSafely(config: WebSocketConfig) {
    const prevConfig = { ...this.currentConfig }
    this.currentConfig = deepMerge(this.currentConfig, config)

    this.handleConfigChange(prevConfig, this.currentConfig)
    this.applyConfig()
  }

  // 处理特定配置变更
  private handleConfigChange(prev: WebSocketConfig, current: WebSocketConfig) {
    // 心跳配置变化
    if (!isEqual(prev.heartbeat, current.heartbeat)) {
      this.reInitHeartbeat()
    }

    // 重连策略变化
    if (
      prev.maxReconnectAttempts !== current.maxReconnectAttempts ||
      prev.reconnectDelay !== current.reconnectDelay ||
      prev.reconnectExponent !== current.reconnectExponent ||
      prev.maxReconnectDelay !== current.maxReconnectDelay
    ) {
      this.resetReconnectTimer()
    }
  }

  // 应用新配置到各模块
  private applyConfig() {
    this.heartbeat?.updateConfig(this.currentConfig)
    this.scheduler?.updateThresholds(this.currentConfig.maxConcurrent)
  }

  private reInitHeartbeat(): void {
    if (!this.currentConfig.isNeedHeartbeat) {
      this.heartbeat?.stop()
      this.heartbeat = undefined
      return
    }

    if (!this.heartbeat) {
      this.initHeartbeat()
    } else {
      this.heartbeat.stop()
      this.heartbeat.start()
    }
  }

  private resetReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.scheduleReconnect()
    }
  }
}
