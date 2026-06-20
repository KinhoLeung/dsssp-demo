import assert from 'node:assert/strict'
import { test } from 'node:test'

import { WebhmiClient } from '../../src/device/client/webhmiClient'
import { MsgId } from '../../src/device/proto/msgId'
import { getWebhmiNamespace } from '../../src/device/proto/webhmi'
import { decodeFrame } from '../../src/device/protocol/frame'
import { createMockTransport } from '../../src/device/testing/mockTransport'

;(globalThis as any).window = globalThis

test('WebhmiClient encodes fire-and-forget SetMusic requests', async () => {
  const transport = createMockTransport()
  const client = new WebhmiClient(transport)
  await client.connect()

  await client.setMusic({ inputGain: -3, musicPitch: 1.5 })
  const frame = decodeFrame(transport.writes[0])
  const pb = getWebhmiNamespace()
  const request = pb.SetMusicRequest.decode(frame.payload)

  assert.equal(frame.msgId, MsgId.SetMusic)
  assert.equal(frame.reqId, undefined)
  assert.equal(request.inputGain, -3)
  assert.equal(request.musicPitch, 1.5)

  await client.disconnect()
})
