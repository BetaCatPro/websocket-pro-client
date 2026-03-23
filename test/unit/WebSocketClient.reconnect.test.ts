import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketEvent } from '../../src/constants/events'
import {
  BASE_CONFIG,
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient reconnect', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('schedules reconnect after error and reconnects once timer fires', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const client = createClient({
      ...BASE_CONFIG,
      maxReconnectAttempts: 1,
      reconnectDelay: 1000,
      reconnectExponent: 1,
      maxReconnectDelay: 1000,
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()
    ws.triggerError()

    expect(FakeWebSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1000)
    expect(FakeWebSocket.instances).toHaveLength(2)

    const overMaxHandler = vi.fn()
    client.on(WebSocketEvent.OverMaxReconnectAttempts, overMaxHandler)
    FakeWebSocket.instances[1].triggerError()
    expect(overMaxHandler).toHaveBeenCalledTimes(1)
  })

  it('reconnects after passive close', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const client = createClient({
      ...BASE_CONFIG,
      maxReconnectAttempts: 1,
      reconnectDelay: 1000,
      reconnectExponent: 1,
      maxReconnectDelay: 1000,
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    ws.onclose?.({ code: 1006, reason: 'abnormal' } as CloseEvent)
    vi.advanceTimersByTime(1000)

    expect(FakeWebSocket.instances).toHaveLength(2)
    client.close()
  })
})
