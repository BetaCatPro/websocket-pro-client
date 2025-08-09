import { WebSocketClient } from "./WebSocketClient";
import { EventEmitter } from "./EventEmitter";
import { WebSocketConfig } from "../types";

export class WebSocketManager extends EventEmitter {
  private readonly clients: Map<string, WebSocketClient> = new Map();

  constructor(private readonly config: Required<WebSocketConfig>) {
    super();
  }

  connect(url: string, protocols: string[] = []): WebSocketClient {
    const key = `${url}|${protocols.join(",")}`;

    if (this.clients.has(key)) {
      return this.clients.get(key)!;
    }

    const client = new WebSocketClient(url, protocols, this.config);
    this.clients.set(key, client);

    // 代理所有客户端事件
    const forwardEvent = (event: string) => (data: any) => {
      this.emit(event, { url, protocols, data });
    };

    client.on("open", forwardEvent("open"));
    client.on("message", forwardEvent("message"));
    client.on("close", forwardEvent("close"));
    client.on("error", forwardEvent("error"));

    return client;
  }

  closeAll(code?: number, reason?: string): void {
    this.clients.forEach((client) => client.close(code, reason));
    this.clients.clear();
  }

  getClient(url: string, protocols?: string[]): WebSocketClient | undefined {
    const key = `${url}|${protocols?.join(",") || ""}`;
    return this.clients.get(key);
  }
}
