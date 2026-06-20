import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  findBleDeviceProfile,
  findHidDeviceProfile,
  getBleRequestFilters,
  getHidRequestFilters,
  uniqueBleServices,
} from '../../src/configs/deviceProfiles'

test('device profile helpers build request filters from configured profiles', () => {
  assert.deepEqual(getHidRequestFilters()[0], {
    vendorId: 0x303a,
    productId: 0x40a0,
    usagePage: 0xff00,
    usage: 0x01,
  })

  assert.deepEqual(getBleRequestFilters(), [{ services: [0x00ff] }])
  assert.deepEqual(uniqueBleServices(), [0x00ff])
})

test('device profile helpers match selected HID and BLE devices', () => {
  const hidProfile = findHidDeviceProfile({
    vendorId: 0x2b53,
    productId: 0x17f6,
    collections: [{ usagePage: 0xff00, usage: 0x01 }],
  })
  assert.equal(hidProfile?.id, 'hc6288-hid-2b53-17f6')

  const bleProfile = findBleDeviceProfile({ name: 'Portable DSSSP BLE speaker' })
  assert.equal(bleProfile?.id, 'esp32-ble-00ff-ff01')
})