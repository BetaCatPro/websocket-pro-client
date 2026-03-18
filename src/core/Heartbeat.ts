import { HeartbeatConfig, WebSocketConfig } from "../types"
import { HeartbeatEvent } from "../constants/heartbeat"
import { EventEmitter } from "./EventEmitter"
import { getLogger } from "../logger"

import { createHeartbeatTimer, TimerId, TimerProvider } from "./HeartbeatTimer"

export class Heartbeat extends EventEmitter {
  private lastPongTime: number = 0
  private lastPingTime: number = 0

  private pingTimer?: TimerId
  private pongTimeoutTimer?: TimerId

  private expectedNextPingAt: number = 0
  private isRunning = false
  private timer: TimerProvider

  constructor(
    private config: HeartbeatConfig = {},
    private readonly sendPing: () => void,
  ) {
    super()
    this.timer = createHeartbeatTimer(this.config)
  }

  start(): void {
    if (!this.config) {
      getLogger().warn("Heartbeat config is empty")
    }
    this.stop()
    this.isRunning = true
    const now = Date.now()
    this.lastPongTime = now
    this.lastPingTime = 0
    this.expectedNextPingAt = now + (this.config.interval ?? 0)
    this.schedulePongTimeoutCheck()
    this.scheduleNextPing()
  }

  stop(): void {
    this.isRunning = false
    this.timer.clearTimeout(this.pingTimer)
    this.timer.clearTimeout(this.pongTimeoutTimer)
  }

  handleDefaultTimeout(cb?: () => void): void {
    this.stop()
    cb && cb()
    this.emit(HeartbeatEvent.Timeout)
  }

  recordPong(): void {
    const now = Date.now()
    const latency = this.lastPingTime ? now - this.lastPingTime : 0
    this.lastPongTime = now
    this.timer.clearTimeout(this.pongTimeoutTimer)
    this.emit(HeartbeatEvent.Pong, latency)
    this.schedulePongTimeoutCheck()
  }

  getLastPongTime(): number {
    return this.lastPongTime
  }

  /**
   * 基于真实时间差做一次超时校验（用于从后台切回前台等场景）
   * @returns true 表示已超时
   */
  checkTimeout(): boolean {
    if (!this.isRunning) return false
    const timeout = this.config.timeout ?? 0
    if (!timeout) return false
    return Date.now() - this.lastPongTime > timeout
  }

  updateConfig(config?: WebSocketConfig) {
    if (!config?.isNeedHeartbeat) {
      this.stop()
      this.timer.destroy?.()
      return
    }
    this.config = { ...this.config, ...config.heartbeat }
    // timerMode 变化时，切换 timer provider
    this.timer.destroy?.()
    this.timer = createHeartbeatTimer(this.config)
    this.stop()
    this.start()
  }

  private scheduleNextPing(): void {
    if (!this.isRunning) return
    const interval = this.config.interval ?? 0

    const now = Date.now()
    // 如果因为后台限频等原因导致大幅漂移，直接以“现在”为基准重置节奏
    if (
      this.expectedNextPingAt <= 0 ||
      now - this.expectedNextPingAt > interval
    ) {
      this.expectedNextPingAt = now + interval
    }

    const delay = Math.max(0, this.expectedNextPingAt - now)
    this.timer.clearTimeout(this.pingTimer)
    this.pingTimer = this.timer.setTimeout(() => {
      if (!this.isRunning) return

      this.lastPingTime = Date.now()
      this.sendPing()

      // 计算下一次 ping 期望时间（漂移修正：按 expected 节奏递推）
      this.expectedNextPingAt = this.expectedNextPingAt + interval
      this.scheduleNextPing()
    }, delay)
  }

  /**
   * 超时检测应以 lastPongTime 为基准：
   * - interval 可能小于 timeout，不能在每次 ping 时重置 timeout，否则会导致永不超时
   * - 这里只在 start/recordPong 时重置检测定时器
   */
  private schedulePongTimeoutCheck(): void {
    if (!this.isRunning) return
    const timeout = this.config.timeout ?? 0
    if (timeout <= 0) return

    this.timer.clearTimeout(this.pongTimeoutTimer)

    const deadline = this.lastPongTime + timeout
    const delay = Math.max(0, deadline - Date.now())

    this.pongTimeoutTimer = this.timer.setTimeout(() => {
      if (!this.isRunning) return
      if (this.checkTimeout()) {
        this.handleDefaultTimeout(this.config.onTimeout)
        return
      }
      // timer 被延迟但未超时：按剩余时间继续检查
      this.schedulePongTimeoutCheck()
    }, delay)
  }
}
