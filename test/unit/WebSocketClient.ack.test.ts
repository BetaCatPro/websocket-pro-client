import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketErrorCode, WebSocketClientError } from '../../src/constants/errors'
import {
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient ack', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('resolves sendWithAck when matching ack is received', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const promise = client.sendWithAck({ type: 'need-ack' })
    await Promise.resolve()

    expect(ws.sentMessages).toHaveLength(1)
    expect(ws.sentMessages[0]).toBe(
      JSON.stringify({
        id: 1,
        payload: {
          seq: 1,
          payload: { type: 'need-ack' },
        },
      }),
    )

    ws.triggerMessage(JSON.stringify({ ackId: 1 }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('rejects sendWithAck when ack timeout reaches max retries', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const promise = client.sendWithAck({ type: 'timeout' })
    await Promise.resolve()

    vi.advanceTimersByTime(60)
    await expect(promise).rejects.toMatchObject({
      code: WebSocketErrorCode.AckMaxRetries,
    } satisfies Partial<WebSocketClientError>)
  })

  it('rejects pending ack promises when client closes', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const promise = client.sendWithAck({ type: 'close-before-ack' })
    await Promise.resolve()

    client.close()

    await expect(promise).rejects.toMatchObject({
      code: WebSocketErrorCode.ClosedBeforeAck,
    } satisfies Partial<WebSocketClientError>)
  })
})
