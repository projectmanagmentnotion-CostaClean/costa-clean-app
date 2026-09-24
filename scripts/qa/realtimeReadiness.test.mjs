import { expect, test } from 'vitest'
import {
  formatRealtimeReadinessMetrics,
  parseRealtimeReadinessFrame,
  REALTIME_READINESS_TOPIC,
} from './realtimeReadiness.mjs'
import { attachRealtimeReadinessProbe } from './realtimeReadinessProbe.mjs'

test('recognizes a protocol-object join request and successful acknowledgement', () => {
  const join = parseRealtimeReadinessFrame(JSON.stringify({
    topic: REALTIME_READINESS_TOPIC,
    event: 'phx_join',
    payload: {},
    ref: '7',
  }))
  const ack = parseRealtimeReadinessFrame(JSON.stringify({
    topic: REALTIME_READINESS_TOPIC,
    event: 'phx_reply',
    payload: { status: 'ok', response: {} },
    ref: '7',
  }), REALTIME_READINESS_TOPIC, '7')

  expect(join).toEqual({ kind: 'JOIN_REQUEST', ref: '7' })
  expect(ack).toEqual({ kind: 'JOIN_ACK', ref: '7' })
})

test('recognizes the Phoenix v2 array frame shape', () => {
  expect(parseRealtimeReadinessFrame(JSON.stringify([
    '7',
    '7',
    REALTIME_READINESS_TOPIC,
    'phx_reply',
    { status: 'ok', response: {} },
  ]), REALTIME_READINESS_TOPIC, '7')).toEqual({ kind: 'JOIN_ACK', ref: '7' })
})

test('ignores wrong topic and reference without exposing frame contents', () => {
  expect(parseRealtimeReadinessFrame({
    topic: 'realtime:other',
    event: 'phx_reply',
    payload: { status: 'ok', response: { token: 'never-public' } },
    ref: '7',
  })).toEqual({ kind: 'IGNORE' })
  expect(parseRealtimeReadinessFrame({
    topic: REALTIME_READINESS_TOPIC,
    event: 'phx_reply',
    payload: { status: 'ok', response: { token: 'never-public' } },
    ref: '8',
  }, REALTIME_READINESS_TOPIC, '7')).toEqual({ kind: 'IGNORE' })
})

test('rejects error and malformed frames safely', () => {
  expect(parseRealtimeReadinessFrame({
    topic: REALTIME_READINESS_TOPIC,
    event: 'phx_reply',
    payload: { status: 'error' },
    ref: '7',
  })).toEqual({ kind: 'JOIN_ERROR' })
  expect(parseRealtimeReadinessFrame('{not-json')).toEqual({ kind: 'IGNORE' })
  expect(parseRealtimeReadinessFrame(['too-short'])).toEqual({ kind: 'IGNORE' })
})

test('formats only the public readiness metrics', () => {
  const output = formatRealtimeReadinessMetrics('2026-09-24T12:00:00.000Z')
  expect(output).toBe('OBSERVER_REALTIME_READY=PASS\nOBSERVER_REALTIME_READY_AT=2026-09-24T12:00:00.000Z')
  expect(output).not.toContain('never-public')
})

test('Playwright probe observes only the matching join acknowledgement', () => {
  const handlers = new Map()
  const page = {
    on(event, handler) {
      handlers.set(event, handler)
    },
    off(event, handler) {
      expect(handlers.get(event)).toBe(handler)
      handlers.delete(event)
    },
  }
  const sent = {}
  const received = {}
  const webSocket = {
    on(event, handler) {
      if (event === 'framesent') sent.handler = handler
      if (event === 'framereceived') received.handler = handler
    },
  }
  const probe = attachRealtimeReadinessProbe(page)

  handlers.get('websocket')(webSocket)
  sent.handler(JSON.stringify({ topic: REALTIME_READINESS_TOPIC, event: 'phx_join', payload: {}, ref: '3' }))
  received.handler(JSON.stringify({ topic: 'realtime:wrong', event: 'phx_reply', payload: { status: 'ok' }, ref: '3' }))
  expect(probe.getResult()).toEqual({ ready: false, readyAt: null })
  received.handler(JSON.stringify({ topic: REALTIME_READINESS_TOPIC, event: 'phx_reply', payload: { status: 'ok' }, ref: '3' }))
  expect(probe.getResult().ready).toBe(true)

  probe.dispose()
  expect(handlers.has('websocket')).toBe(false)
})
