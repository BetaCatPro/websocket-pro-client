export declare enum WebSocketErrorCode {
    MsgPackNotInstalled = "MSG_PACK_NOT_INSTALLED",
    AckTimeout = "ACK_TIMEOUT",
    AckMaxRetries = "ACK_MAX_RETRIES",
    ClosedBeforeAck = "CLOSED_BEFORE_ACK",
    OfflineQueueOverflow = "OFFLINE_QUEUE_OVERFLOW",
    OfflineQueueTTLExpired = "OFFLINE_QUEUE_TTL_EXPIRED",
    ClosedBeforeSend = "CLOSED_BEFORE_SEND"
}
export declare const WebSocketErrorMessage: Record<WebSocketErrorCode, string>;
export declare class WebSocketClientError extends Error {
    code: WebSocketErrorCode;
    constructor(code: WebSocketErrorCode);
}
