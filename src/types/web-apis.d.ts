export {}

declare global {
  interface HIDInputReportEvent extends Event {
    data: DataView
    device: HIDDevice
    reportId: number
  }

  interface HIDDevice extends EventTarget {
    vendorId: number
    productId: number
    opened: boolean
    open(): Promise<void>
    close(): Promise<void>
    sendReport(reportId: number, data: BufferSource): Promise<void>
    addEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void
    removeEventListener(type: 'inputreport', listener: (event: HIDInputReportEvent) => void): void
  }
  interface HID {
    getDevices(): Promise<HIDDevice[]>
    requestDevice(options: { filters: Array<Record<string, unknown>> }): Promise<HIDDevice[]>
  }

  interface BluetoothRemoteGATTCharacteristic extends EventTarget {
    value?: DataView
    writeValue(value: BufferSource): Promise<void>
    startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
    stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
    addEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
    removeEventListener(type: 'characteristicvaluechanged', listener: (event: Event) => void): void
  }

  interface BluetoothRemoteGATTService {
    getCharacteristic(characteristic: number | string): Promise<BluetoothRemoteGATTCharacteristic>
  }

  interface BluetoothRemoteGATTServer {
    connected: boolean
    connect(): Promise<BluetoothRemoteGATTServer>
    disconnect(): void
    getPrimaryService(service: number | string): Promise<BluetoothRemoteGATTService>
  }

  interface BluetoothDevice extends EventTarget {
    id: string
    name?: string
    gatt?: BluetoothRemoteGATTServer
  }
  interface Bluetooth {
    requestDevice(options: { acceptAllDevices?: boolean; filters?: Array<Record<string, unknown>> }): Promise<BluetoothDevice>
  }

  interface Navigator {
    hid?: HID
    bluetooth?: Bluetooth
  }
}
