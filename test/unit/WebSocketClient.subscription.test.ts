import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BASE_CONFIG, FakeWebSocket, createClient, setupWebSocketTest } from './websocketClientTestUtils'

describe('WebSocketClient subscription', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('dispatches message to topic subscribers', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    client.subscribe('order.updated', handler)
    ws.triggerMessage(JSON.stringify({ topic: 'order.updated', payload: { id: 1 } }))
    await Promise.resolve()

    expect(handler).toHaveBeenCalledWith({
      topic: 'order.updated',
      payload: { id: 1 },
    })
  })

  it('supports unsubscribe by disposer and by topic', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const first = vi.fn()
    const second = vi.fn()
    const dispose = client.subscribe('notice', first)
    client.subscribe('notice', second)

    dispose()
    ws.triggerMessage(JSON.stringify({ topic: 'notice', payload: 1 }))
    await Promise.resolve()
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    client.unsubscribe('notice')
    ws.triggerMessage(JSON.stringify({ topic: 'notice', payload: 2 }))
    await Promise.resolve()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('auto re-subscribes after reconnect when buildSubscribeMessage is configured', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5)
    const client = createClient({
      ...BASE_CONFIG,
      reconnectDelay: 1000,
      reconnectExponent: 1,
      maxReconnectDelay: 1000,
      subscription: {
        ...BASE_CONFIG.subscription,
        autoResubscribe: true,
        buildSubscribeMessage: (topic) => ({
          type: 'SUB',
          topic,
        }),
      },
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    client.subscribe('chat.room.1', vi.fn())
    ws.triggerError()
    vi.advanceTimersByTime(1000)

    expect(FakeWebSocket.instances).toHaveLength(2)
    const reconnectWs = FakeWebSocket.instances[1]
    reconnectWs.triggerOpen()

    expect(reconnectWs.sentMessages.some((msg) =>
      msg.includes('"type":"SUB"') && msg.includes('"topic":"chat.room.1"'),
    )).toBe(true)
  })

  it('dispatches messages to wildcard topic subscribers', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    client.subscribe('order.*', handler)
    ws.triggerMessage(
      JSON.stringify({ topic: 'order.updated', payload: { id: 2 } }),
    )
    await Promise.resolve()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      topic: 'order.updated',
      payload: { id: 2 },
    })
  })

  it('supports ? wildcard topic matching', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    client.subscribe('order.updat?d', handler)

    ws.triggerMessage(
      JSON.stringify({ topic: 'order.updated', payload: { id: 10 } }),
    )
    await Promise.resolve()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      topic: 'order.updated',
      payload: { id: 10 },
    })
  })

  it('supports {a,b} alternative topic matching', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    client.subscribe('order.{created,updated}', handler)

    ws.triggerMessage(
      JSON.stringify({ topic: 'order.created', payload: { id: 1 } }),
    )
    ws.triggerMessage(
      JSON.stringify({ topic: 'order.updated', payload: { id: 2 } }),
    )
    await Promise.resolve()

    expect(handler).toHaveBeenCalledTimes(2)
    expect(handler).toHaveBeenNthCalledWith(1, {
      topic: 'order.created',
      payload: { id: 1 },
    })
    expect(handler).toHaveBeenNthCalledWith(2, {
      topic: 'order.updated',
      payload: { id: 2 },
    })
  })

  it('supports batch subscribe with array', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    const dispose = client.subscribe(['order.created', 'order.updated'], handler)

    ws.triggerMessage(
      JSON.stringify({ topic: 'order.created', payload: { id: 100 } }),
    )
    ws.triggerMessage(
      JSON.stringify({ topic: 'order.updated', payload: { id: 200 } }),
    )
    await Promise.resolve()

    expect(handler).toHaveBeenCalledTimes(2)
    dispose()

    ws.triggerMessage(
      JSON.stringify({ topic: 'order.updated', payload: { id: 300 } }),
    )
    await Promise.resolve()
    expect(handler).toHaveBeenCalledTimes(2)
  })

  it('subscribeOnce triggers only once', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = vi.fn()
    client.subscribeOnce('notice', handler)

    ws.triggerMessage(JSON.stringify({ topic: 'notice', payload: 1 }))
    ws.triggerMessage(JSON.stringify({ topic: 'notice', payload: 2 }))
    await Promise.resolve()

    expect(handler).toHaveBeenCalledTimes(1)
    expect(handler).toHaveBeenCalledWith({
      topic: 'notice',
      payload: 1,
    })
  })
})
