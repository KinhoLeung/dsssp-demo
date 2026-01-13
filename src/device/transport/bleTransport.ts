import type { Transport, TransportOnBytes } from './transport'

type BleTransportOptions = {
  service: number | string
  characteristic: number | string
  notify?: boolean
  chunkSize?: number
}

export class BleTransport implements Transport {
  public readonly kind = 'ble' as const

  private readonly handlers = new Set<TransportOnBytes>()
  private isConnected = false
  private characteristic: BluetoothRemoteGATTCharacteristic | null = null

  private readonly onCharacteristicValueChanged = (event: Event) => {
    const target = event.target as BluetoothRemoteGATTCharacteristic
    const value = target.value
    if (!value) return
    const chunk = new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
    for (const handler of this.handlers) handler(chunk)
  }

  constructor(
    private readonly device: BluetoothDevice,
    private readonly options: BleTransportOptions,
  ) {}

  async connect() {
    if (this.isConnected) return
    if (!this.device.gatt) throw new Error('BLE device has no GATT server')

    const server = await this.device.gatt.connect()
    const service = await server.getPrimaryService(this.options.service)
    const characteristic = await service.getCharacteristic(this.options.characteristic)
    this.characteristic = characteristic

    if (this.options.notify !== false) {
      await characteristic.startNotifications()
      characteristic.addEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged)
    }

    this.isConnected = true
  }

  async disconnect() {
    if (!this.isConnected) return

    const characteristic = this.characteristic
    if (characteristic) {
      characteristic.removeEventListener('characteristicvaluechanged', this.onCharacteristicValueChanged)
      try {
        await characteristic.stopNotifications()
      } catch {
        // ignored
      }
    }

    this.device.gatt?.disconnect()
    this.characteristic = null
    this.isConnected = false
  }

  async write(bytes: Uint8Array) {
    if (!this.isConnected) throw new Error('BLE not connected')
    const characteristic = this.characteristic
    if (!characteristic) throw new Error('BLE characteristic not ready')

    const chunkSize = typeof this.options.chunkSize === 'number' ? this.options.chunkSize : 20
    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + chunkSize, bytes.length))
      await characteristic.writeValue(chunk)
    }
  }

  onBytes(handler: TransportOnBytes) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

