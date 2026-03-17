export enum HeartbeatMessage {
  Ping = "PING",
  Pong = "PONG",
}

/** Heartbeat 内部发出的事件名 */
export enum HeartbeatEvent {
  Timeout = "timeout",
  Pong = "PONG",
}
