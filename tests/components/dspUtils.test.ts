import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildPanelStateFromEq,
  mapFilterTypeToGraphType,
  mapGraphTypeToFilterType,
} from '../../src/components/dsp/dspUtils'

test('filter type mapping round trips supported graph types', () => {
  assert.equal(mapFilterTypeToGraphType(0 as any), 'PEAK')
  assert.equal(mapFilterTypeToGraphType(1 as any), 'LOWSHELF2')
  assert.equal(mapFilterTypeToGraphType(2 as any), 'HIGHSHELF2')
  assert.equal(mapFilterTypeToGraphType(3 as any), 'LOWPASS2')
  assert.equal(mapFilterTypeToGraphType(4 as any), 'HIGHPASS2')
  assert.equal(mapFilterTypeToGraphType(5 as any), 'BANDPASS')
  assert.equal(mapFilterTypeToGraphType(6 as any), 'NOTCH')

  assert.equal(mapGraphTypeToFilterType('PEAK' as any), 0)
  assert.equal(mapGraphTypeToFilterType('LOWPASS1' as any), 3)
  assert.equal(mapGraphTypeToFilterType('HIGHPASS2' as any), 4)
})

test('buildPanelStateFromEq sorts points and assigns allowed filter types by slot', () => {
  const state = buildPanelStateFromEq({
    point: [
      { index: 2, type: 3 as any, freq: 20000, gain: 0, q: 0.7, peakQ: 1.5 },
      { index: 0, type: 4 as any, freq: 20, gain: 0, q: 0.8, peakQ: 1.6 },
      { index: 1, type: 0 as any, freq: 1000, gain: 1, q: 0.9, peakQ: 2.1 },
    ],
    highPassTypeList: [4 as any],
    typeList: [0 as any, 1 as any, 2 as any],
    lowPassTypeList: [3 as any],
  })

  assert.deepEqual(state.pointIndexByUiIndex, [0, 1, 2])
  assert.deepEqual(state.filters.map((filter) => filter.type), ['HIGHPASS2', 'PEAK', 'LOWPASS2'])
  assert.deepEqual(state.allowedTypesByUiIndex[0], ['HIGHPASS2'])
  assert.deepEqual(state.allowedTypesByUiIndex[1], ['PEAK', 'LOWSHELF2', 'HIGHSHELF2'])
  assert.deepEqual(state.allowedTypesByUiIndex[2], ['LOWPASS2'])
  assert.deepEqual(
    state.filters.map((filter) => filter.q),
    [0.8, 2.1, 0.7],
  )
  assert.deepEqual(
    state.filters.map((filter) => [filter.commonQ, filter.peakQ]),
    [[0.8, 1.6], [0.9, 2.1], [0.7, 1.5]],
  )
})
