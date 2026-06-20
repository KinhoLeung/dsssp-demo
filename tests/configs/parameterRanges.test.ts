import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildParameterRanges,
  clampToRange,
  withRangeBounds,
} from '../../src/configs/parameterRanges'

test('buildParameterRanges uses device min/max/step when valid', () => {
  const ranges = buildParameterRanges({
    music: {
      eq: {
        minFreq: 40,
        maxFreq: 16000,
        stepFreq: 5,
        minGain: -9,
        maxGain: 6,
        stepGain: 0.5,
      },
      minInputGain: -6,
      maxInputGain: 3,
      stepInputGain: 1,
    },
  })

  assert.deepEqual(ranges.music.eq.freq, { min: 40, max: 16000, step: 5 })
  assert.deepEqual(ranges.music.eq.gain, { min: -9, max: 6, step: 0.5 })
  assert.deepEqual(ranges.music.inputGain, { min: -6, max: 3, step: 1 })
})

test('buildParameterRanges falls back when device range is invalid', () => {
  const ranges = buildParameterRanges({
    music: {
      eq: {
        minFreq: 20000,
        maxFreq: 20,
        stepFreq: 0,
      },
    },
  })

  assert.deepEqual(ranges.music.eq.freq, { min: 20, max: 20000, step: 1 })
})

test('range helpers clamp and apply additional bounds', () => {
  const base = { min: 0, max: 80, step: 1 }

  assert.deepEqual(withRangeBounds(base, { max: 60 }), { min: 0, max: 60, step: 1 })
  assert.equal(clampToRange(120, base), 80)
  assert.equal(clampToRange(-5, base), 0)
})
