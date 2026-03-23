import { beforeEach, describe, expect, it } from 'vitest'

import { WebSocketClientState } from '../../src/types'
import {
  BASE_CONFIG,
  FakeWebSocket,
  createClient,
  setupWebSocketTest,
} from './websocketClientTestUtils'

function assertState(
  actual: WebSocketClientState,
  expected: WebSocketClientState,
) {
  expect(actual).toBe(expected)
}

describe('WebSocketClient state & stats', () => {
  beforeEach(() => {
    setupWebSocketTest()
  })

  it('getState reflects connecting/open/closed', () => {
    const client = createClient()
    assertState(client.getState(), WebSocketClientState.Connecting)

    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()
    assertState(client.getState(), WebSocketClientState.Open)

    client.close()
    assertState(client.getState(), WebSocketClientState.Closed)
  })

  it('getStats exposes queue length and pending ack count', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const promise = client.sendWithAck({ type: 'ack-test' })
    await Promise.resolve()

    const stats = client.getStats()
    expect(stats.sentCount).toBe(1)
    expect(stats.receivedCount).toBe(0)
    expect(stats.errorCount).toBe(0)
    expect(stats.pendingAcksCount).toBe(1)
    expect(stats.messageQueueLength).toBe(0)
    expect(stats.reconnectAttempts).toBe(0)
    expect(stats.subscribedTopicCount).toBe(0)
    expect(stats.subscriptionListenerCount).toBe(0)

    // 清理 pending，避免定时器触发影响其他用例
    ws.triggerMessage(JSON.stringify({ ackId: 1 }))
    await expect(promise).resolves.toBeUndefined()
  })

  it('getState shows reconnecting after error', () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    ws.triggerError()
    assertState(client.getState(), WebSocketClientState.Reconnecting)
    const stats = client.getStats()
    expect(stats.errorCount).toBe(1)
    expect(stats.reconnectScheduledCount).toBe(1)
    expect(stats.lastErrorAt).toBeTypeOf('number')
  })

  it('getState becomes overMaxReconnectAttempts when maxReconnectAttempts is 0', () => {
    const client = createClient({
      ...BASE_CONFIG,
      isNeedHeartbeat: false,
      maxReconnectAttempts: 0,
    })
    const ws = FakeWebSocket.instances[0]
    ws.triggerError()

    assertState(client.getState(), WebSocketClientState.OverMaxReconnectAttempts)
  })

  it('getStats includes close and subscription details', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const handler = () => {}
    client.subscribe('topic.a', handler)
    client.subscribe('topic.b', handler)

    const statsBeforeClose = client.getStats()
    expect(statsBeforeClose.subscribedTopicCount).toBe(2)
    expect(statsBeforeClose.subscriptionListenerCount).toBe(2)

    client.close(4001, 'manual-close')
    const stats = client.getStats()
    expect(stats.lastCloseCode).toBe(4001)
    expect(stats.lastCloseReason).toBe('manual-close')
    expect(stats.lastCloseAt).toBeTypeOf('number')
  })

  it('resetStats only resets metrics fields', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    client.subscribe('topic.a', () => {})
    const ackPromise = client.sendWithAck({ type: 'ack-test' })
    await Promise.resolve()
    ws.triggerError()
    client.close(4001, 'manual-close')
    await expect(ackPromise).rejects.toBeTruthy()

    client.resetStats()
    const stats = client.getStats()
    expect(stats.sentCount).toBe(0)
    expect(stats.receivedCount).toBe(0)
    expect(stats.errorCount).toBe(0)
    expect(stats.reconnectScheduledCount).toBe(0)
    expect(stats.ackTimeoutCount).toBe(0)
    expect(stats.lastHeartbeatLatency).toBeUndefined()
    expect(stats.lastErrorAt).toBeUndefined()
    expect(stats.lastCloseCode).toBeUndefined()
    expect(stats.lastCloseReason).toBeUndefined()
    expect(stats.lastCloseAt).toBeUndefined()

    // resetStats 不影响结构性/运行时指标
    expect(stats.subscribedTopicCount).toBe(1)
    expect(stats.subscriptionListenerCount).toBe(1)
    expect(stats.pendingAcksCount).toBe(0)
    assertState(client.getState(), WebSocketClientState.Closed)
  })

  it('resetStats supports selective reset via options', async () => {
    const client = createClient()
    const ws = FakeWebSocket.instances[0]
    ws.triggerOpen()

    const ackPromise = client.sendWithAck({ type: 'ack-test' })
    await Promise.resolve()
    ws.triggerError()
    client.close(4002, 'manual-close-2')
    await expect(ackPromise).rejects.toBeTruthy()

    client.resetStats({ resetCounters: true, resetLastEvents: false })
    let stats = client.getStats()
    expect(stats.sentCount).toBe(0)
    expect(stats.errorCount).toBe(0)
    expect(stats.lastErrorAt).toBeTypeOf('number')
    expect(stats.lastCloseCode).toBe(4002)

    client.resetStats({ resetCounters: false, resetLastEvents: true })
    stats = client.getStats()
    expect(stats.lastErrorAt).toBeUndefined()
    expect(stats.lastCloseCode).toBeUndefined()
    expect(stats.lastCloseReason).toBeUndefined()
  })
})

