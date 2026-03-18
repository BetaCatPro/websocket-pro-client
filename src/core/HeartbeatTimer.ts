import { getLogger } from "../logger"
import type { HeartbeatConfig } from "../types"
import { HeartbeatTimerMode } from "../constants/heartbeat"

export type TimerId = number
export type TimerHandler = () => void

export type TimerProvider = {
  setTimeout(handler: TimerHandler, delay: number): TimerId
  clearTimeout(id?: TimerId): void
  destroy?: () => void
}

class MainThreadTimer implements TimerProvider {
  setTimeout(handler: TimerHandler, delay: number): TimerId {
    return globalThis.setTimeout(handler, delay) as unknown as TimerId
  }

  clearTimeout(id?: TimerId): void {
    if (id === undefined) return
    globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
  }
}

class WorkerTimer implements TimerProvider {
  private worker?: Worker
  private readonly callbackMap = new Map<number, TimerHandler>()
  private nextId = 1
  private isAvailable = false

  constructor() {
    this.worker = this.createWorker()
    this.isAvailable = Boolean(this.worker)
  }

  get available(): boolean {
    return this.isAvailable
  }

  setTimeout(handler: TimerHandler, delay: number): TimerId {
    if (!this.worker || !this.isAvailable) {
      return globalThis.setTimeout(handler, delay) as unknown as TimerId
    }

    const id = this.nextId++
    this.callbackMap.set(id, handler)
    try {
      this.worker.postMessage({ type: "setTimeout", id, delay })
    } catch {
      this.markUnavailable()
      return globalThis.setTimeout(handler, delay) as unknown as TimerId
    }
    return id
  }

  clearTimeout(id?: TimerId): void {
    if (id === undefined) return
    if (!this.worker || !this.isAvailable) {
      globalThis.clearTimeout(id as unknown as ReturnType<typeof setTimeout>)
      return
    }
    this.callbackMap.delete(id)
    try {
      this.worker.postMessage({ type: "clearTimeout", id })
    } catch {
      this.markUnavailable()
    }
  }

  destroy(): void {
    this.callbackMap.clear()
    try {
      this.worker?.terminate()
    } catch {
      // ignore
    }
    this.worker = undefined
    this.isAvailable = false
  }

  private createWorker(): Worker | undefined {
    if (typeof Worker === "undefined") return
    if (typeof URL === "undefined" || typeof Blob === "undefined") return

    const source = `
      const timers = new Map()
      self.onmessage = (e) => {
        const msg = e.data || {}
        const { type, id, delay } = msg
        if (type === 'setTimeout') {
          const t = setTimeout(() => {
            self.postMessage({ type: 'fire', id })
            timers.delete(id)
          }, delay)
          timers.set(id, t)
          return
        }
        if (type === 'clearTimeout') {
          const t = timers.get(id)
          if (t) clearTimeout(t)
          timers.delete(id)
          return
        }
      }
    `

    try {
      const blob = new Blob([source], { type: "application/javascript" })
      const url = URL.createObjectURL(blob)
      const worker = new Worker(url)
      URL.revokeObjectURL(url)

      worker.onmessage = (e) => {
        const msg = e.data || {}
        if (msg.type !== "fire") return
        const handler = this.callbackMap.get(msg.id)
        if (!handler) return
        this.callbackMap.delete(msg.id)
        handler()
      }

      worker.onerror = () => {
        this.markUnavailable()
      }

      return worker
    } catch {
      return
    }
  }

  private markUnavailable(): void {
    this.isAvailable = false
    const w = this.worker
    this.worker = undefined
    try {
      w?.terminate()
    } catch {
      getLogger().error("Heartbeat worker error")
    }
  }
}

export function createHeartbeatTimer(config: HeartbeatConfig): TimerProvider {
  const mode = config.timerMode ?? HeartbeatTimerMode.Auto
  if (mode === HeartbeatTimerMode.Main) return new MainThreadTimer()

  const wt = new WorkerTimer()
  if (mode === HeartbeatTimerMode.Worker && !wt.available) {
    getLogger().warn("Heartbeat worker timer unavailable, fallback to main")
    wt.destroy()
    return new MainThreadTimer()
  }
  if (mode === HeartbeatTimerMode.Auto && !wt.available) {
    wt.destroy()
    return new MainThreadTimer()
  }
  return wt
}
