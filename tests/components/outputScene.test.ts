import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  getOutputEqForScene,
  getOutputMixerForScene,
  getSceneModeFromConfig,
  mixerPatchForScene,
} from '../../src/components/dsp/useOutputScene'

test('output scene helpers resolve sing/dance EQ and mixer with fallback', () => {
  const output = {
    singEq: { bypass: false },
    danceEq: { bypass: true },
    singMixer: { musicLevel: 10 },
    danceMixer: { musicLevel: 20 },
  }

  assert.equal(getSceneModeFromConfig({ db: { system: { sceneMode: 1 as any } } } as any), 1)
  assert.equal(getOutputEqForScene(output, 0 as any), output.singEq)
  assert.equal(getOutputEqForScene(output, 1 as any), output.danceEq)
  assert.equal(getOutputMixerForScene(output, 0 as any), output.singMixer)
  assert.equal(getOutputMixerForScene(output, 1 as any), output.danceMixer)
  assert.deepEqual(mixerPatchForScene(0 as any, { musicLevel: 30 }), { singMixer: { musicLevel: 30 } })
  assert.deepEqual(mixerPatchForScene(1 as any, { musicLevel: 30 }), { danceMixer: { musicLevel: 30 } })
})
