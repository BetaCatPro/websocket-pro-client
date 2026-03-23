import { WebSocketClient } from "./WebSocketClient"
import { EventEmitter } from "./EventEmitter"
import { WebSocketConfig, WebSocketEvent } from "../types"
import { ALL_WEB_SOCKET_EVENTS } from "../constants/events"

export class WebSocketManager extends EventEmitter {
  private readonly clients: Map<string, WebSocketClient> = new Map()

  constructor(private readonly config: Required<WebSocketConfig>) {
    super()
  }

  connect(url: string, protocols: string[] = []): WebSocketClient {
    const key = `${url}|${protocols.join(",")}`

    if (this.clients.has(key)) {
      return this.clients.get(key)!
    }

    const client = new WebSocketClient(url, protocols, this.config)
    this.clients.set(key, client)

    // 代理所有客户端事件
    const forwardEvent = (event: WebSocketEvent) => (data: any) => {
      this.emit(event, { url, protocols, data })
    }

    ALL_WEB_SOCKET_EVENTS.forEach((event) => {
      client.on(event, forwardEvent(event))
    })

    return client
  }

  closeAll(code?: number, reason?: string): void {
    this.clients.forEach((client) => client.close(code, reason))
    this.clients.clear()
  }

  getClient(url: string, protocols?: string[]): WebSocketClient | undefined {
    const key = `${url}|${protocols?.join(",") || ""}`
    return this.clients.get(key)
  }
}
