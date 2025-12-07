import { type DeviceClient, type TransportType } from './types'

type BleClientOptions = {
  serviceUuid: BluetoothServiceUUID
  txCharacteristicUuid: BluetoothCharacteristicUUID
  rxCharacteristicUuid?: BluetoothCharacteristicUUID
  maxChunkSize?: number
}

class BleClient implements DeviceClient {
  readonly transport: TransportType = 'ble'

  readonly options: BleClientOptions

  label = 'BLE'

  private device?: BluetoothDevice

  private server?: BluetoothRemoteGATTServer

  private txCharacteristic?: BluetoothRemoteGATTCharacteristic

  private rxCharacteristic?: BluetoothRemoteGATTCharacteristic

  private onData?: (data: Uint8Array) => void

  private onDisconnectCb?: () => void

  constructor(options: BleClientOptions) {
    this.options = options
  }

  private handleDisconnect = () => {
    this.server = undefined
    this.txCharacteristic = undefined
    if (this.rxCharacteristic) {
      this.rxCharacteristic.removeEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicValueChanged
      )
    }
    this.rxCharacteristic = undefined
    this.onDisconnectCb?.()
  }

  private handleCharacteristicValueChanged = (
    event: Event & { target: BluetoothRemoteGATTCharacteristic }
  ) => {
    const value = event.target.value
    if (!value) return
    const data = new Uint8Array(value.buffer)
    this.onData?.(data)
  }

  async connect() {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator))
      throw new Error('Web Bluetooth is not supported in this browser')

    const device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: [this.options.serviceUuid]
    })

    if (!device) throw new Error('No BLE device selected')

    this.device = device
    this.label = device.name || 'BLE Device'
    device.addEventListener('gattserverdisconnected', this.handleDisconnect)

    const server = await device.gatt?.connect()
    if (!server) throw new Error('Unable to establish GATT connection')
    this.server = server

    const service = await server.getPrimaryService(this.options.serviceUuid)
    this.txCharacteristic = await service.getCharacteristic(
      this.options.txCharacteristicUuid
    )

    if (this.options.rxCharacteristicUuid) {
      this.rxCharacteristic = await service.getCharacteristic(
        this.options.rxCharacteristicUuid
      )
      await this.rxCharacteristic.startNotifications()
      this.rxCharacteristic.addEventListener(
        'characteristicvaluechanged',
        this.handleCharacteristicValueChanged
      )
    }
  }

  async send(data: Uint8Array) {
    if (!this.txCharacteristic)
      throw new Error('BLE characteristic is not ready')

    const chunkSize = this.options.maxChunkSize ?? data.length
    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, offset + chunkSize)
      if (
        this.txCharacteristic.properties.writeWithoutResponse &&
        this.txCharacteristic.writeValueWithoutResponse
      ) {
        await this.txCharacteristic.writeValueWithoutResponse(chunk)
      } else {
        await this.txCharacteristic.writeValueWithResponse(chunk)
      }
    }
  }

  async disconnect() {
    if (!this.device) return
    this.handleDisconnect()
    if (this.device.gatt?.connected) this.device.gatt.disconnect()
    this.device.removeEventListener('gattserverdisconnected', this.handleDisconnect)
    this.device = undefined
  }

  onMessage(callback: (data: Uint8Array) => void) {
    this.onData = callback
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCb = callback
  }

  isConnected() {
    return !!this.device?.gatt?.connected
  }
}

export default BleClient
