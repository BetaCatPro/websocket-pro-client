export enum WebSocketErrorCode {
  MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED",
  AckTimeout = "ACK_TIMEOUT",
  AckMaxRetries = "ACK_MAX_RETRIES",
  ClosedBeforeAck = "CLOSED_BEFORE_ACK",
  OfflineQueueOverflow = "OFFLINE_QUEUE_OVERFLOW",
  OfflineQueueTTLExpired = "OFFLINE_QUEUE_TTL_EXPIRED",
  ClosedBeforeSend = "CLOSED_BEFORE_SEND",
}

export const WebSocketErrorMessage: Record<WebSocketErrorCode, string> = {
  [WebSocketErrorCode.MsgPackNotInstalled]:
    "MsgPack serializer requires @msgpack/msgpack installation",
  [WebSocketErrorCode.AckTimeout]: "ACK timeout",
  [WebSocketErrorCode.AckMaxRetries]:
    "ACK timeout, maximum retry attempts reached",
  [WebSocketErrorCode.ClosedBeforeAck]:
    "WebSocket connection closed before ACK was received",
  [WebSocketErrorCode.OfflineQueueOverflow]:
    "Offline message queue overflow",
  [WebSocketErrorCode.OfflineQueueTTLExpired]:
    "Offline message queue message TTL expired",
  [WebSocketErrorCode.ClosedBeforeSend]:
    "WebSocket connection closed before offline queued send",
}

export class WebSocketClientError extends Error {
  code: WebSocketErrorCode

  constructor(code: WebSocketErrorCode) {
    super(WebSocketErrorMessage[code])
    this.code = code
    this.name = "WebSocketClientError"
  }
}
