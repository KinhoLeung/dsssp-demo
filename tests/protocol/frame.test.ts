import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  decodeFrame,
  encodeFrame,
  FLAG_ENCRYPTED,
  FLAG_RESPONSE,
  PROTOCOL_VERSION,
} from '../../src/device/protocol/frame'
import { FrameStreamDecoder } from '../../src/device/protocol/streamDecoder'

test('encodeFrame/decodeFrame round trips payload and extensions', () => {
  const payload = new Uint8Array([1, 2, 3, 4])
  const raw = encodeFrame({
    msgId: 0x1234,
    flags: FLAG_RESPONSE | FLAG_ENCRYPTED,
    reqId: 0x33,
    ivSync: 0x80000005,
    result: 0,
    payload,
  })

  const frame = decodeFrame(raw)

  assert.equal(frame.ver, PROTOCOL_VERSION)
  assert.equal(frame.msgId, 0x1234)
  assert.equal(frame.flags, FLAG_RESPONSE | FLAG_ENCRYPTED)
  assert.equal(frame.reqId, 0x33)
  assert.equal(frame.ivSync, 0x80000005)
  assert.equal(frame.result, 0)
  assert.deepEqual([...frame.payload], [...payload])
})

test('decodeFrame rejects CRC mismatches', () => {
  const raw = encodeFrame({
    msgId: 0x0001,
    flags: FLAG_RESPONSE,
    payload: new Uint8Array([9, 8, 7]),
  })
  raw[raw.length - 3] ^= 0xff

  assert.throws(() => decodeFrame(raw), /CRC16 mismatch/)
})

test('FrameStreamDecoder recovers from noise and supports split/sticky packets', () => {
  const first = encodeFrame({ msgId: 1, flags: 0, payload: new Uint8Array([1]) })
  const second = encodeFrame({ msgId: 2, flags: 0, payload: new Uint8Array([2, 3]) })
  const decoder = new FrameStreamDecoder()

  assert.deepEqual(decoder.push(new Uint8Array([0, 1, 2, first[0]])), [])
  const rest = first.subarray(1)
  const sticky = new Uint8Array(rest.length + second.length)
  sticky.set(rest)
  sticky.set(second, rest.length)

  const frames = decoder.push(sticky)

  assert.equal(frames.length, 2)
  assert.equal(frames[0].msgId, 1)
  assert.equal(frames[1].msgId, 2)
  assert.deepEqual([...frames[0].payload], [1])
  assert.deepEqual([...frames[1].payload], [2, 3])
})
