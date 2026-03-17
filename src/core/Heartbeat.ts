import { HeartbeatConfig, WebSocketConfig } from "../types"
import { HeartbeatEvent } from "../constants/heartbeat"
import { EventEmitter } from "./EventEmitter"
import { getLogger } from "../logger"

export class Heartbeat extends EventEmitter {
  private lastPongTime: number = 0
  private intervalId?: ReturnType<typeof setInterval>
  private timeoutId?: ReturnType<typeof setTimeout>

  constructor(
    private config: HeartbeatConfig = {},
    private readonly sendPing: () => void,
  ) {
    super()
  }

  start(): void {
    if (!this.config) {
      getLogger().warn("Heartbeat config is empty")
    }
    this.stop()
    this.lastPongTime = Date.now()
    this.intervalId = setInterval(() => {
      this.sendPing()
      this.timeoutId = setTimeout(() => {
        this.handleDefaultTimeout(this.config.onTimeout)
      }, this.config.timeout)
    }, this.config.interval)
  }

  stop(): void {
    clearInterval(this.intervalId)
    clearTimeout(this.timeoutId)
  }

  handleDefaultTimeout(cb?: () => void): void {
    this.stop()
    cb && cb()
    this.emit(HeartbeatEvent.Timeout)
  }

  recordPong(): void {
    this.lastPongTime = Date.now()
    clearTimeout(this.timeoutId)
    this.emit(HeartbeatEvent.Pong, Date.now() - this.lastPongTime)
  }

  getLastPongTime(): number {
    return this.lastPongTime
  }

  updateConfig(config?: WebSocketConfig) {
    if (!config?.isNeedHeartbeat) {
      this.stop()
      return
    }
    this.config = { ...this.config, ...config.heartbeat }
    this.stop()
    this.start()
  }
}
