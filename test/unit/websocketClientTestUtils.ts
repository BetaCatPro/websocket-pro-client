import { vi } from 'vitest'

import { WebSocketClient } from '../../src/core/WebSocketClient'
import { OfflineQueueDropStrategy, WebSocketConfig } from '../../src/types'

export class FakeWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3
  static instances: FakeWebSocket[] = []

  binaryType: BinaryType = 'blob'
  readyState = FakeWebSocket.CONNECTING
  sentMessages: any[] = []

  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(
    public readonly url: string,
    public readonly protocols?: string | string[],
  ) {
    FakeWebSocket.instances.push(this)
  }

  send(data: any) {
    this.sentMessages.push(data)
  }

  close(code?: number, reason?: string) {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.({ code, reason } as CloseEvent)
  }

  triggerOpen() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.({} as Event)
  }

  triggerMessage(data: any) {
    this.onmessage?.({ data } as MessageEvent)
  }

  triggerError() {
    this.onerror?.({} as Event)
  }
}

export const BASE_CONFIG: Required<WebSocketConfig> = {
  maxReconnectAttempts: 2,
  reconnectDelay: 1000,
  reconnectExponent: 1.5,
  maxReconnectDelay: 30000,
  connectionPoolSize: 5,
  maxConcurrent: 1,
  defaultPriority: 1,
  enableCompression: false,
  serializer: {
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  },
  ack: {
    enabled: true,
    timeout: 50,
    maxRetries: 0,
    generateId: () => 1,
    wrapOutbound: (id, data) => ({
      id,
      payload: data,
    }),
    extractAckId: (message) =>
      message && typeof message === 'object' && 'ackId' in message
        ? (message.ackId as number)
        : null,
  },
  sequence: {
    enabled: true,
    generateSeq: () => 1,
    wrapOutbound: (seq, data) => ({
      seq,
      payload: data,
    }),
    extractInboundSeq: (message) =>
      message && typeof message === 'object' && 'seq' in message
        ? (message.seq as number)
        : null,
  },
  isNeedHeartbeat: false,
  heartbeat: {
    interval: 25000,
    timeout: 45000,
    pingMessage: 'PING',
    pongMessage: 'PONG',
    timerMode: 'main',
  },
  offlineQueue: {
    enabled: true,
    maxQueueSize: 1000,
    dropStrategy: OfflineQueueDropStrategy.DropOldest,
    messageTTL: undefined,
  },
}

export function setupWebSocketTest() {
  vi.useFakeTimers()
  vi.restoreAllMocks()
  FakeWebSocket.instances = []
  vi.stubGlobal('WebSocket', FakeWebSocket as unknown as typeof WebSocket)
}

export function createClient(config?: Required<WebSocketConfig>) {
  return new WebSocketClient(
    'wss://example.test',
    ['chat'],
    (config ?? BASE_CONFIG) as Required<WebSocketConfig>,
  )
}
