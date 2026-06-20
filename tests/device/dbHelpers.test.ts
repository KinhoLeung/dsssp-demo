import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  applyEqBypassPatch,
  applyEqPointPatch,
  applySectionPatch,
  buildEqPatchesFromPending,
  mergePatch,
  type PendingEqTarget,
} from '../../src/device/utils/dbHelpers'

test('mergePatch deep merges defined nested values', () => {
  const result = mergePatch(
    { output: { volume: 1, delay: 2 }, untouched: true },
    { output: { volume: 3 } },
  )

  assert.deepEqual(result, {
    output: { volume: 3, delay: 2 },
    untouched: true,
  })
})

test('applySectionPatch preserves missing sections and merges existing sections', () => {
  assert.equal(applySectionPatch(null, { mute: true }), null)

  const section = { mute: false, nested: { a: 1, b: 2 } }
  const result = applySectionPatch(section, { nested: { b: 3 } })

  assert.deepEqual(result, { mute: false, nested: { a: 1, b: 3 } })
})

test('EQ patches update target scene by point index', () => {
  const db: any = {
    db: {
      mainOutput: {
        singEq: { bypass: false, point: [{ index: 1, freq: 1000, gain: 0, q: 1 }] },
        danceEq: { bypass: false, point: [{ index: 1, freq: 2000, gain: 0, q: 1 }] },
      },
    },
  }

  applyEqBypassPatch(db, 5, true, 1)
  applyEqPointPatch(db, 5, { index: 1, freq: 3000 }, 1)

  assert.equal(db.db.mainOutput.singEq.bypass, false)
  assert.equal(db.db.mainOutput.danceEq.bypass, true)
  assert.equal(db.db.mainOutput.singEq.point[0].freq, 1000)
  assert.equal(db.db.mainOutput.danceEq.point[0].freq, 3000)
})

test('buildEqPatchesFromPending only emits fields changed from base DB', () => {
  const baseDb: any = {
    db: {
      music: {
        eq: {
          bypass: false,
          point: [{ index: 0, type: 0, freq: 1000, gain: 0, q: 1 }],
        },
      },
    },
  }
  const pending = new Map<string, PendingEqTarget>()
  pending.set('0', {
    target: 0 as any,
    bypass: false,
    points: new Map([
      [0, { index: 0, type: 0 as any, freq: 1200, gain: 0, q: 1 }],
    ]),
  })

  const patches = buildEqPatchesFromPending(pending, baseDb)

  assert.deepEqual(patches, [
    {
      target: 0,
      point: [{ index: 0, freq: 1200 }],
    },
  ])
})
