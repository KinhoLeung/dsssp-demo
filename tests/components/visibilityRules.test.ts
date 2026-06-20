import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildSystemVisibility,
  buildTuningVisibility,
  getAvailableTuningTabs,
  getInitialTuningTab,
} from '../../src/components/dsp/visibilityRules'
import { webhmi } from '../../src/device/proto/generated/webhmi'

test('visibility rules derive available tabs in stable UI order', () => {
  const db: webhmi.IDeviceDb = {
    system: {},
    echo: {},
    music: {},
    mainOutput: {},
  }

  assert.deepEqual(getAvailableTuningTabs(db), ['music', 'echo', 'mainoutput', 'system'])
  assert.equal(getInitialTuningTab(db), 'music')
  assert.equal(getInitialTuningTab(null), 'music')
})

test('visibility rules expose system cards only when fields exist', () => {
  assert.deepEqual(buildSystemVisibility({}), {
    showDanceModeCard: false,
    showSystemDefaultsCard: false,
    showSystemLimitsCard: false,
  })

  assert.deepEqual(buildSystemVisibility({
    micDetectionTime: 10,
    useDefaultVolume: false,
    musicMaxVolume: 60,
  }), {
    showDanceModeCard: true,
    showSystemDefaultsCard: true,
    showSystemLimitsCard: true,
  })
})

test('visibility rules centralize auth and output auto disable policy', () => {
  const db: webhmi.IDeviceDb = {
    system: { controlMode: webhmi.OutputControlMode.OUTPUT_CONTROL_AUTO },
    mic: {
      micAEq: { eq: { point: [] } },
      micBEq: { eq: { point: [] } },
    },
    mainOutput: {},
  }

  const online = buildTuningVisibility(db, true)
  assert.equal(online.showMicSelector, true)
  assert.equal(online.disabled.mainOutput, false)
  assert.equal(online.disabled.mainOutputEq, true)
  assert.equal(online.disabled.mainOutputMixer, true)

  const manual = buildTuningVisibility({
    ...db,
    system: { controlMode: webhmi.OutputControlMode.OUTPUT_CONTROL_MANUAL },
  }, true)
  assert.equal(manual.disabled.mainOutputEq, false)
  assert.equal(manual.disabled.mainOutputMixer, false)

  const locked = buildTuningVisibility(db, false)
  assert.equal(locked.disabled.music, true)
  assert.equal(locked.disabled.system, true)
})