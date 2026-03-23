import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createWebSocketManager } from '../../src'
import { WebSocketEvent } from '../../src/constants/events'
import {
  FakeWebSocket,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketManager', () => {
  beforeEach(() => {
    setupWebSocketTest()
    ;(window as any).__ws_pro_client_ack_id__ = 1
  })

  it('deep merges nested ack config in createWebSocketManager', async () => {
    const manager = createWebSocketManager({
      ack: {
        timeout: 10,
      },
    })
    const client = manager.connect('wss://example.test')
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const promise = client.sendWithAck({ type: 'manager-ack' })
    await Promise.resolve()

    const payload = JSON.parse(ws.sentMessages[0])
    expect(payload.id).toBe(1)
    expect(payload.payload).toEqual({
      seq: 1,
      payload: { type: 'manager-ack' },
    })

    ws.triggerMessage(JSON.stringify({ ackId: 1 }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('forwards non-core events from client to manager', () => {
    const manager = createWebSocketManager({
      isNeedHeartbeat: true,
      heartbeat: {
        interval: 20,
        timeout: 100,
        pingMessage: 'PING',
      },
    })
    const latencyHandler = vi.fn()
    manager.on(WebSocketEvent.Latency, latencyHandler)

    const client = manager.connect('wss://example.test')
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()
    ws.triggerMessage(JSON.stringify('PONG'))

    expect(latencyHandler).toHaveBeenCalledTimes(1)
    client.close()
  })
})
