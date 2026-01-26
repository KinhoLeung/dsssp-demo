export type HidDeviceProfile = {
  id: string
  label: string
  vendorId: number
  productId: number
  reportId: number
  reportSize: number
}

export type BleDeviceProfile = {
  id: string
  label: string
  service: number | string
  characteristic: number | string
  notify?: boolean
}

export const HID_DEVICE_PROFILES: HidDeviceProfile[] = [
  {
    id: 'esp32-hid-303a-40a0',
    label: 'DSSSP HID',
    vendorId: 0x303a,
    productId: 0x40a0,
    reportId: 0x00,
    reportSize: 64,
  },
  {
    id: 'hc6288-hid-2b53-17f6',
    label: 'HC6288 HID (SDK default)',
    vendorId: 0x2b53,
    productId: 0x17f6,
    reportId: 0x00,
    reportSize: 64,
    usagePage: 0xff00,
  },
]

export const BLE_DEVICE_PROFILES: BleDeviceProfile[] = [
  {
    id: 'esp32-ble-00ff-ff01',
    label: 'DSSSP BLE',
    service: 0x00ff,
    characteristic: 0xff01,
    notify: true,
  },
]

export const uniqueBleServices = () => {
  return Array.from(new Set(BLE_DEVICE_PROFILES.map((p) => p.service)))
}
