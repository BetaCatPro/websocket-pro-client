import { Heartbeat } from "./Heartbeat"
import { TaskScheduler } from "./TaskScheduler"
import { EventEmitter } from "./EventEmitter"
import { WebSocketConfig, WebSocketEvent } from "../types"
import { HeartbeatEvent, HeartbeatMessage } from "../constants/heartbeat"
import { DEFAULT_CONFIG } from "../config"
import { deepMerge, isEqual } from "../utils"
import { WebSocketClientError, WebSocketErrorCode } from "../constants/errors"
import { getLogger } from "../logger"

export class WebSocketClient extends EventEmitter {
  private currentConfig: Required<WebSocketConfig>
  private socket: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer?: ReturnType<typeof setTimeout>
  private readonly messageQueue: Array<{
    data: any
    priority: number
    needAck: boolean
    resolve: () => void
    reject: (err: Error) => void
  }> = []
  private heartbeat?: Heartbeat
  private readonly scheduler: TaskScheduler

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
      this.send(this.currentConfig.heartbeat?.message || "PING")
    })

    this.heartbeat.on(HeartbeatEvent.Timeout, () => {
      getLogger().warn("Heartbeat timeout, triggering reconnect...")
      if (this.socket?.readyState === WebSocket.OPEN) {
        this.close(1000, "heartbeat timeout")
      }
      this.scheduleReconnect()
    })
  }

  private connect(): void {
    this.socket = new WebSocket(this.url, this.protocols)
    this.socket.binaryType = "arraybuffer"

    this.socket.onopen = (event) => {
      this.reconnectAttempts = 0
      clearTimeout(this.reconnectTimer)
      this.heartbeat && this.heartbeat.start()
      this.flushMessageQueue()
      this.emit(WebSocketEvent.Open, event)
    }

    this.socket.onmessage = (event) => {
      if (event.data === HeartbeatMessage.Pong) {
        this.heartbeat && this.heartbeat.recordPong()
        return
      }

      const raw = event.data
      let parsed: any = raw

      // 使用全局 serializer 做解析，供 ACK / 序列号使用
      try {
        parsed = this.currentConfig.serializer.deserialize(raw)
      } catch {
        // 反序列化失败时，不影响原始事件分发
        parsed = raw
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
    }

    this.socket.onclose = (event) => {
      this.heartbeat && this.heartbeat.stop()
      this.emit(WebSocketEvent.Close, event)
    }

    this.socket.onerror = (event) => {
      this.heartbeat && this.heartbeat.stop()
      this.emit(WebSocketEvent.Error, event)
      this.scheduleReconnect()
    }
  }

  private sendRaw(data: any): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(data)
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.currentConfig.maxReconnectAttempts) {
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
      this.reconnectAttempts++
      this.connect()
    }, actualDelay)
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
      return this.scheduler.add(() => {
        return new Promise((resolve, reject) => {
          try {
            let outbound = data

            // 1. 序列号包装
            const seqCfg = this.currentConfig.sequence
            if (seqCfg?.enabled && typeof seqCfg.wrapOutbound === "function") {
              const seq = seqCfg.generateSeq?.()
              if (seq !== undefined) {
                outbound = seqCfg.wrapOutbound(seq, outbound)
              }
            }

            // 2. ACK 包装
            const ackCfg = this.currentConfig.ack
            let ackId: string | number | null = null
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

            // 不需要 ACK 或未成功生成 id，直接结束
            if (!needAck || !ackCfg?.enabled || ackId === null) {
              resolve()
              return
            }

            const timeout = ackCfg.timeout ?? 5000
            const maxRetries = ackCfg.maxRetries ?? 0

            const entry = {
              resolve,
              reject: (err: Error) => reject(err),
              retries: 0,
              rawData: data,
              priority,
              timer: setTimeout(() => {
                this.handleAckTimeout(ackId as string | number)
              }, timeout),
            }

            this.pendingAcks.set(ackId as string | number, entry)
          } catch (err) {
            reject(err as Error)
          }
        })
      }, priority)
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

  close(code?: number, reason?: string): void {
    clearTimeout(this.reconnectTimer)
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
    this.reconnectAttempts = 0
    this.close()
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
