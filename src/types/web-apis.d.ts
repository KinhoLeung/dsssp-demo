export { }

declare global {
  interface HIDInputReportEvent extends Event {
    data: DataView
    device: HIDDevice
    reportId: number
  }

  interface HIDCollectionInfo {
    usagePage?: number
    usage?: number
  }

  interface HIDDevice extends EventTarget {
    vendorId: number
    productId: number
    opened: boolean
    collections: HIDCollectionInfo[]
    open(): Promise<void>
    close(): Promise<void>
    sendReport(reportId: number, data: BufferSource): Promise<void>
    addEventListener(type: string, listener: (event: any) => void): void
    removeEventListener(type: string, listener: (event: any) => void): void
  }

  interface HIDConnectionEvent extends Event {
    device: HIDDevice
  }

  interface HID extends EventTarget {
    getDevices(): Promise<HIDDevice[]>
    requestDevice(options: { filters: Array<Record<string, unknown>> }): Promise<HIDDevice[]>
    addEventListener(type: string, listener: any, options?: boolean | AddEventListenerOptions): void
    removeEventListener(type: string, listener: any, options?: boolean | EventListenerOptions): void
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
  interface BluetoothRequestDeviceOptions {
    filters?: Array<Record<string, unknown>>
    optionalServices?: Array<number | string>
    acceptAllDevices?: boolean
  }

  interface Bluetooth extends EventTarget {
    requestDevice(options: BluetoothRequestDeviceOptions): Promise<BluetoothDevice>
  }

  interface Navigator {
    hid?: HID
    bluetooth?: Bluetooth
  }
}
