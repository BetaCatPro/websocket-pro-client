import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BASE_CONFIG,
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient config update', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('applies updated serializer via updateConfig', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    await client.updateConfig({
      serializer: {
        serialize: (data) => `custom:${JSON.stringify(data)}`,
        deserialize: JSON.parse,
      },
    })

    await client.send({ changed: true })
    expect(ws.sentMessages[0]).toBe(
      'custom:{"seq":1,"payload":{"changed":true}}',
    )
  })

  it('stops heartbeat sending after updateConfig disables heartbeat', async () => {
    const client = createClient({
      ...BASE_CONFIG,
      isNeedHeartbeat: true,
      heartbeat: {
        ...BASE_CONFIG.heartbeat,
        interval: 20,
        timeout: 100,
      },
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    vi.advanceTimersByTime(21)
    const sentBeforeDisable = ws.sentMessages.length
    expect(sentBeforeDisable).toBeGreaterThan(0)

    await client.updateConfig({
      isNeedHeartbeat: false,
    })

    vi.advanceTimersByTime(100)
    expect(ws.sentMessages.length).toBe(sentBeforeDisable)
    client.close()
  })
})
