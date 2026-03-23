import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WebSocketEvent } from '../../src/constants/events'
import {
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

describe('WebSocketClient connect', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('creates socket immediately with url and protocols', () => {
    createClient()

    expect(FakeWebSocket.instances).toHaveLength(1)
    expect(FakeWebSocket.instances[0].url).toBe('wss://example.test')
    expect(FakeWebSocket.instances[0].protocols).toEqual(['chat'])
  })

  it('queues messages before open and flushes after open', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]

    const sendPromise = client.send({ hello: 'world' })
    expect(ws.sentMessages).toHaveLength(0)

    ws.triggerOpen()
    await Promise.resolve()
    await sendPromise

    expect(ws.sentMessages).toHaveLength(1)
    expect(ws.sentMessages[0]).toBe(
      JSON.stringify({
        seq: 1,
        payload: { hello: 'world' },
      }),
    )
  })

  it('emits parsed message and records inbound sequence', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const onMessage = vi.fn()
    client.on(WebSocketEvent.Message, onMessage)

    ws.triggerMessage(JSON.stringify({ seq: 77, payload: 'data' }))
    await Promise.resolve()

    expect(onMessage).toHaveBeenCalledWith({ seq: 77, payload: 'data' })
    expect(client.getLastInboundSeq()).toBe(77)
  })
})
