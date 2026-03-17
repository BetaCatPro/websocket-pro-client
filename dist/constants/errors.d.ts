export declare enum WebSocketErrorCode {
    MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED",
    AckTimeout = "ACK_TIMEOUT",
    AckMaxRetries = "ACK_MAX_RETRIES",
    ClosedBeforeAck = "CLOSED_BEFORE_ACK"
}
export declare const WebSocketErrorMessage: Record<WebSocketErrorCode, string>;
export declare class WebSocketClientError extends Error {
    code: WebSocketErrorCode;
    constructor(code: WebSocketErrorCode);
}
