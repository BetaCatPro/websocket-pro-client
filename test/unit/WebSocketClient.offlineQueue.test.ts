import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketErrorCode } from '../../src/constants/errors'
import { OfflineQueueDropStrategy } from '../../src/types'
import {
  BASE_CONFIG,
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient offline queue', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('dropOldest overflow rejects oldest queued message and keeps newest', async () => {
    const client = createClient({
      ...BASE_CONFIG,
      offlineQueue: {
        enabled: true,
        maxQueueSize: 1,
        dropStrategy: OfflineQueueDropStrategy.DropOldest,
        messageTTL: undefined,
      },
    })

    const ws = FakeWebSocket.instances[0]

    const p1 = client.send({ a: 1 })
    const p2 = client.send({ a: 2 })

    await expect(p1).rejects.toMatchObject({
      code: WebSocketErrorCode.OfflineQueueOverflow,
    })

    ws.triggerOpen()
    await p2

    expect(ws.sentMessages).toHaveLength(1)
    expect(ws.sentMessages[0]).toBe(
      JSON.stringify({
        seq: 1,
        payload: { a: 2 },
      }),
    )
  })

  it('rejects queued messages after TTL expiration', async () => {
    vi.advanceTimersByTime(0)
    const client = createClient({
      ...BASE_CONFIG,
      offlineQueue: {
        enabled: true,
        maxQueueSize: 10,
        dropStrategy: OfflineQueueDropStrategy.DropOldest,
        messageTTL: 50,
      },
    })

    const ws = FakeWebSocket.instances[0]
    const p = client.send({ ttl: true })

    vi.advanceTimersByTime(100)
    ws.triggerOpen()

    await expect(p).rejects.toMatchObject({
      code: WebSocketErrorCode.OfflineQueueTTLExpired,
    })
    expect(ws.sentMessages).toHaveLength(0)
  })

  it('rejects sendWithAck when queue overflow strategy is reject', async () => {
    const client = createClient({
      ...BASE_CONFIG,
      offlineQueue: {
        enabled: true,
        maxQueueSize: 0,
        dropStrategy: OfflineQueueDropStrategy.Reject,
        messageTTL: undefined,
      },
    })

    const p = client.sendWithAck({ ack: 'x' })
    await expect(p).rejects.toMatchObject({
      code: WebSocketErrorCode.OfflineQueueOverflow,
    })
  })
})

