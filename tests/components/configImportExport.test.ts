import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  buildExportConfig,
  defaultExportFilename,
  validateImportConfig,
} from '../../src/components/dsp/useConfigImportExport'

const t = (key: string, options?: Record<string, unknown>) => {
  if (typeof options?.defaultValue === 'string') return options.defaultValue
  return key
}

const uiText = (text: string) => text

test('buildExportConfig removes internal fields and system section', () => {
  const source: any = {
    deviceId: 'dev-a',
    _internal: 'drop-me',
    db: {
      system: { mute: true },
      music: { inputGain: -1, _private: 'drop-me' },
    },
  }

  const exported = buildExportConfig(source) as any

  assert.equal(exported._internal, undefined)
  assert.equal(exported.db.system, undefined)
  assert.deepEqual(exported.db.music, { inputGain: -1 })
  assert.equal(source.db.system.mute, true)
})

test('defaultExportFilename uses device id and firmware version fallbacks', () => {
  assert.equal(defaultExportFilename({ deviceId: 'hc6288', firmwareVersion: 'v1.2.3' } as any), 'hc6288-v1.2.3-')
  assert.equal(defaultExportFilename(null), 'device-v0-')
})

test('validateImportConfig blocks device mismatch and major version mismatch', () => {
  const current: any = { deviceId: 'dev-a', firmwareVersion: 'v1.2.0', db: {} }

  const deviceMismatch = validateImportConfig(
    { deviceId: 'dev-b', firmwareVersion: 'v1.2.0', db: {} } as any,
    current,
    { t: t as any, ns: 'deviceDemo', uiText },
  )
  assert.equal(deviceMismatch.kind, 'error')

  const majorMismatch = validateImportConfig(
    { deviceId: 'dev-a', firmwareVersion: 'v2.0.0', db: {} } as any,
    current,
    { t: t as any, ns: 'deviceDemo', uiText },
  )
  assert.equal(majorMismatch.kind, 'error')
})

test('validateImportConfig warns on minor mismatch and accepts compatible imports', () => {
  const current: any = { deviceId: 'dev-a', firmwareVersion: 'v1.2.0', db: {} }

  const warning = validateImportConfig(
    { deviceId: 'dev-a', firmwareVersion: 'v1.3.0', db: { music: {} } } as any,
    current,
    { t: t as any, ns: 'deviceDemo', uiText },
  )
  assert.equal(warning.kind, 'warning')

  const ok = validateImportConfig(
    { deviceId: 'dev-a', firmwareVersion: 'v1.2.0', db: { music: {} } } as any,
    current,
    { t: t as any, ns: 'deviceDemo', uiText },
  )
  assert.equal(ok.kind, 'ok')
})
test('validateImportConfig rejects files without database content', () => {
  assert.throws(
    () => validateImportConfig(
      { deviceId: 'dev-a', firmwareVersion: 'v1.2.0' } as any,
      { deviceId: 'dev-a', firmwareVersion: 'v1.2.0', db: {} } as any,
      { t: t as any, ns: 'deviceDemo', uiText },
    ),
    /missing database content/,
  )
})
