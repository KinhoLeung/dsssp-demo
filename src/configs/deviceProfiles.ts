export type HidDeviceProfile = {
  id: string
  label: string
  vendorId: number
  productId: number
  reportId: number
  reportSize: number
  usagePage?: number
  usage?: number
}

export type BleDeviceProfile = {
  id: string
  label: string
  service: number | string
  characteristic: number | string
  notify?: boolean
}

export type HidDeviceLike = {
  vendorId: number
  productId: number
  collections?: Array<{
    usagePage?: number
    usage?: number
  }>
}

export type BleDeviceLike = {
  name?: string
}

export const HID_DEVICE_PROFILES: HidDeviceProfile[] = [
  {
    id: 'esp32-hid-303a-40a0',
    label: 'DSSSP HID',
    vendorId: 0x303a,
    productId: 0x40a0,
    reportId: 0x00,
    reportSize: 64,
    usagePage: 0xff00,
    usage: 0x01,
  },
  {
    id: 'hc6288-hid-2b53-17f6',
    label: 'HC6288 HID (SDK default)',
    vendorId: 0x2b53,
    productId: 0x17f6,
    reportId: 0x00,
    reportSize: 64,
    usagePage: 0xff00,
    usage: 0x01,
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

export const getHidRequestFilters = () =>
  HID_DEVICE_PROFILES.map((profile) => ({
    vendorId: profile.vendorId,
    productId: profile.productId,
    usagePage: profile.usagePage,
    usage: profile.usage,
  }))

export const findHidDeviceProfile = (device: HidDeviceLike) =>
  HID_DEVICE_PROFILES.find((profile) => {
    if (profile.vendorId !== device.vendorId || profile.productId !== device.productId) return false
    if (profile.usagePage === undefined && profile.usage === undefined) return true

    return (device.collections ?? []).some((collection) =>
      (profile.usagePage === undefined || collection.usagePage === profile.usagePage) &&
      (profile.usage === undefined || collection.usage === profile.usage),
    )
  }) ?? HID_DEVICE_PROFILES[0]

export const getBleRequestFilters = () =>
  BLE_DEVICE_PROFILES.map((profile) => ({ services: [profile.service] }))

export const uniqueBleServices = () => Array.from(new Set(BLE_DEVICE_PROFILES.map((profile) => profile.service)))

export const findBleDeviceProfile = (device: BleDeviceLike) =>
  BLE_DEVICE_PROFILES.find((profile) => device.name?.includes(profile.label)) ?? BLE_DEVICE_PROFILES[0]