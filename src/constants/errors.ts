export enum WebSocketErrorCode {
  MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED",
  AckTimeout = "ACK_TIMEOUT",
  AckMaxRetries = "ACK_MAX_RETRIES",
  ClosedBeforeAck = "CLOSED_BEFORE_ACK",
}

export const WebSocketErrorMessage: Record<WebSocketErrorCode, string> = {
  [WebSocketErrorCode.MsgPackNotInstalled]:
    "MsgPack serializer requires @msgpack/msgpack installation",
  [WebSocketErrorCode.AckTimeout]: "ACK timeout",
  [WebSocketErrorCode.AckMaxRetries]:
    "ACK timeout, maximum retry attempts reached",
  [WebSocketErrorCode.ClosedBeforeAck]:
    "WebSocket connection closed before ACK was received",
}

export class WebSocketClientError extends Error {
  code: WebSocketErrorCode

  constructor(code: WebSocketErrorCode) {
    super(WebSocketErrorMessage[code])
    this.code = code
    this.name = "WebSocketClientError"
  }
}
