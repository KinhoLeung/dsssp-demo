import assert from 'node:assert/strict'
import { test } from 'node:test'

import { extractRpcResultName, formatDeviceErrorMessage } from '../../src/device/utils/errorMessages'

test('formatDeviceErrorMessage maps RPC result names through i18n', () => {
  const message = 'Command failed (msg_id=0x3, req_id=12, result=VALUE_OUT_OF_RANGE)'
  const t = (key: string, options?: Record<string, unknown>) => {
    if (key === 'deviceErrors.result.value_out_of_range') return '参数超出设备允许范围。'
    return String(options?.defaultValue ?? key)
  }

  assert.equal(extractRpcResultName(message), 'VALUE_OUT_OF_RANGE')
  assert.equal(formatDeviceErrorMessage(message, t), '参数超出设备允许范围。')
})

test('formatDeviceErrorMessage keeps non-RPC errors readable', () => {
  const t = (key: string, options?: Record<string, unknown>) => String(options?.defaultValue ?? key)

  assert.equal(formatDeviceErrorMessage('Disconnected', t), 'Disconnected')
})