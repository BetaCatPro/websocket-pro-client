export declare enum WebSocketEvent {
    Open = "open",
    Message = "message",
    Close = "close",
    Error = "error",
    Reconnect = "reconnect",
    Heartbeat = "heartbeat",
    Latency = "latency",
    OverMaxReconnectAttempts = "overMaxReconnectAttempts"
}
export declare const CORE_WEB_SOCKET_EVENTS: WebSocketEvent[];
export declare const ALL_WEB_SOCKET_EVENTS: WebSocketEvent[];
