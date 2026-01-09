export {}

declare global {
  interface HIDDevice {}
  interface HID {
    requestDevice(options: { filters: Array<Record<string, unknown>> }): Promise<HIDDevice[]>
  }

  interface BluetoothDevice {}
  interface Bluetooth {
    requestDevice(options: { acceptAllDevices?: boolean; filters?: Array<Record<string, unknown>> }): Promise<BluetoothDevice>
  }

  interface Navigator {
    hid?: HID
    bluetooth?: Bluetooth
  }
}
