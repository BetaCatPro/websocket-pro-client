import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketEvent } from '../../src/constants/events'
import {
  BASE_CONFIG,
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient heartbeat', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('sends heartbeat ping after connection open', () => {
    const client = createClient({
      ...BASE_CONFIG,
      isNeedHeartbeat: true,
      heartbeat: {
        ...BASE_CONFIG.heartbeat,
        interval: 20,
        timeout: 100,
        pingMessage: 'PING',
      },
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    vi.advanceTimersByTime(21)

    expect(ws.sentMessages).toContain(JSON.stringify('PING'))
    client.close()
  })

  it('supports custom getPing and isPong heartbeat strategy', async () => {
    const client = createClient({
      ...BASE_CONFIG,
      isNeedHeartbeat: true,
      heartbeat: {
        ...BASE_CONFIG.heartbeat,
        interval: 20,
        timeout: 100,
        getPing: () => ({ type: 'ping' }),
        isPong: (_raw, parsed) => parsed?.type === 'pong',
      },
    })
    const ws = FakeWebSocket.instances[0]

    const heartbeatHandler = vi.fn()
    const messageHandler = vi.fn()
    client.on(WebSocketEvent.Heartbeat, heartbeatHandler)
    client.on(WebSocketEvent.Message, messageHandler)

    ws.triggerOpen()
    vi.advanceTimersByTime(21)
    expect(ws.sentMessages).toContain(JSON.stringify({ type: 'ping' }))

    ws.triggerMessage(JSON.stringify({ type: 'pong' }))
    await Promise.resolve()

    expect(heartbeatHandler).toHaveBeenCalledTimes(1)
    expect(messageHandler).not.toHaveBeenCalled()
    client.close()
  })
})
