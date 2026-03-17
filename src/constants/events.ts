export enum WebSocketEvent {
  Open = "open",
  Message = "message",
  Close = "close",
  Error = "error",
  Reconnect = "reconnect",
  Heartbeat = "heartbeat",
  Latency = "latency",
  OverMaxReconnectAttempts = "overMaxReconnectAttempts",
}

export const CORE_WEB_SOCKET_EVENTS: WebSocketEvent[] = [
  WebSocketEvent.Open,
  WebSocketEvent.Message,
  WebSocketEvent.Close,
  WebSocketEvent.Error,
]

export const ALL_WEB_SOCKET_EVENTS: WebSocketEvent[] = [
  WebSocketEvent.Open,
  WebSocketEvent.Message,
  WebSocketEvent.Close,
  WebSocketEvent.Error,
  WebSocketEvent.Reconnect,
  WebSocketEvent.Heartbeat,
  WebSocketEvent.Latency,
  WebSocketEvent.OverMaxReconnectAttempts,
]
