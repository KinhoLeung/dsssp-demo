import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  decodeFrame,
  encodeFrame,
  FLAG_ENCRYPTED,
  FLAG_EVENT,
  FLAG_RESPONSE,
} from '../../src/device/protocol/frame'
import { RpcSession } from '../../src/device/session/rpcSession'
import { createMockTransport } from '../../src/device/testing/mockTransport'

;(globalThis as any).window = globalThis

const encryptPayload = async (
  key: CryptoKey,
  baseIv: Uint8Array,
  ivSync: number,
  payload: Uint8Array,
) => {
  const iv = new Uint8Array(16)
  iv.set(baseIv)
  new DataView(iv.buffer).setUint32(12, ivSync, false)
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-CTR', counter: iv, length: 128 },
    key,
    payload as any,
  )
  return new Uint8Array(cipher)
}

const waitForWrites = async (transport: ReturnType<typeof createMockTransport>, count: number) => {
  for (let i = 0; i < 20; i++) {
    if (transport.writes.length >= count) return
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
  throw new Error(`Timed out waiting for ${count} transport write(s)`)
}

test('RpcSession matches responses by request id', async () => {
  const transport = createMockTransport()
  const session = new RpcSession(transport)
  await session.start()

  const pending = session.request(0x1234, new Uint8Array([1, 2, 3]), { timeoutMs: 100 })
  const requestFrame = decodeFrame(transport.writes[0])

  transport.emitBytes(encodeFrame({
    msgId: 0x1234,
    flags: FLAG_RESPONSE,
    reqId: requestFrame.reqId,
    result: 0,
    payload: new Uint8Array([9]),
  }))

  const response = await pending
  assert.deepEqual([...response.payload], [9])

  await session.stop()
})

test('RpcSession rejects response frames with missing or non-OK result', async () => {
  const missingResultTransport = createMockTransport()
  const missingResultSession = new RpcSession(missingResultTransport)
  await missingResultSession.start()

  const missingResultPending = missingResultSession.request(0x1235, new Uint8Array(), { timeoutMs: 100 })
  const missingResultRequest = decodeFrame(missingResultTransport.writes[0])
  missingResultTransport.emitBytes(encodeFrame({
    msgId: 0x1235,
    flags: FLAG_RESPONSE,
    reqId: missingResultRequest.reqId,
  }))

  await assert.rejects(missingResultPending, /response missing result/)
  await missingResultSession.stop()

  const failedResultTransport = createMockTransport()
  const failedResultSession = new RpcSession(failedResultTransport)
  await failedResultSession.start()

  const failedResultPending = failedResultSession.request(0x1236, new Uint8Array(), { timeoutMs: 100 })
  const failedResultRequest = decodeFrame(failedResultTransport.writes[0])
  failedResultTransport.emitBytes(encodeFrame({
    msgId: 0x1236,
    flags: FLAG_RESPONSE,
    reqId: failedResultRequest.reqId,
    result: 0x0004,
  }))

  await assert.rejects(failedResultPending, /VALUE_OUT_OF_RANGE/)
  await failedResultSession.stop()
})

test('RpcSession dispatches event frames', async () => {
  const transport = createMockTransport()
  const session = new RpcSession(transport)
  await session.start()

  const events: number[] = []
  session.onEvent((frame) => events.push(frame.msgId))
  transport.emitBytes(encodeFrame({ msgId: 0x77, flags: FLAG_EVENT, payload: new Uint8Array([1]) }))

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(events, [0x77])

  await session.stop()
})

test('RpcSession rejects timed out requests and disconnects in-flight requests', async () => {
  const timeoutTransport = createMockTransport()
  const timeoutSession = new RpcSession(timeoutTransport)
  await timeoutSession.start()

  await assert.rejects(
    timeoutSession.request(0x55, new Uint8Array(), { timeoutMs: 5 }),
    /Timeout waiting for response/,
  )
  await timeoutSession.stop()

  const disconnectTransport = createMockTransport()
  const disconnectSession = new RpcSession(disconnectTransport)
  await disconnectSession.start()
  const pending = disconnectSession.request(0x56, new Uint8Array(), { timeoutMs: 100 })
  await disconnectSession.stop()

  await assert.rejects(pending, /Disconnected/)
})

test('RpcSession encrypts requests and drops replayed encrypted events', async () => {
  const transport = createMockTransport()
  const session = new RpcSession(transport)
  await session.start()

  const keyBytes = new Uint8Array(16).fill(7)
  const key = await crypto.subtle.importKey('raw', keyBytes, { name: 'AES-CTR' }, false, ['encrypt', 'decrypt'])
  const baseIv = new Uint8Array(12).fill(3)
  session.enableEncryption(key, baseIv)

  const pending = session.request(0x66, new Uint8Array([1, 2, 3]), { timeoutMs: 100 })
  await waitForWrites(transport, 1)
  const requestFrame = decodeFrame(transport.writes[0])

  assert.equal((requestFrame.flags & FLAG_ENCRYPTED) !== 0, true)
  assert.equal(requestFrame.ivSync, 0)
  assert.notDeepEqual([...requestFrame.payload], [1, 2, 3])

  const responsePayload = new Uint8Array([9, 9])
  const encryptedResponse = await encryptPayload(key, baseIv, 0x80000000, responsePayload)
  transport.emitBytes(encodeFrame({
    msgId: 0x66,
    flags: FLAG_RESPONSE | FLAG_ENCRYPTED,
    reqId: requestFrame.reqId,
    ivSync: 0x80000000,
    result: 0,
    payload: encryptedResponse,
  }))

  const response = await pending
  assert.deepEqual([...response.payload], [...responsePayload])

  const events: number[] = []
  session.onEvent((frame) => events.push(frame.msgId))
  const replayPayload = await encryptPayload(key, baseIv, 0x80000000, new Uint8Array([1]))
  transport.emitBytes(encodeFrame({
    msgId: 0x67,
    flags: FLAG_EVENT | FLAG_ENCRYPTED,
    ivSync: 0x80000000,
    payload: replayPayload,
  }))

  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.deepEqual(events, [])

  await session.stop()
})
