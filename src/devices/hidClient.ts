import { type DeviceClient, type TransportType } from './types'

type HidClientOptions = {
  filters?: HIDDeviceFilter[]
  reportId?: number
  packetSize?: number
}

class HidClient implements DeviceClient {
  readonly transport: TransportType = 'hid'

  readonly options: HidClientOptions

  label = 'USB HID'

  private device?: HIDDevice

  private onData?: (data: Uint8Array) => void

  private onDisconnectCb?: () => void

  private handleDisconnect = (event: HIDConnectionEvent) => {
    if (event.device !== this.device) return
    this.device = undefined
    this.onDisconnectCb?.()
  }

  constructor(options: HidClientOptions) {
    this.options = options
  }

  private handleInputReport = (event: HIDInputReportEvent) => {
    const data = new Uint8Array(event.data.buffer)
    this.onData?.(data)
  }

  async connect() {
    if (typeof navigator === 'undefined' || !('hid' in navigator))
      throw new Error('WebHID is not supported in this browser')

    const filters = this.options.filters ?? []
    const devices = await navigator.hid.requestDevice({ filters })
    const [device] = devices

    if (!device) throw new Error('No HID device selected')

    this.device = device
    this.label = device.productName || 'USB HID'

    device.addEventListener('inputreport', this.handleInputReport)
    navigator.hid.addEventListener('disconnect', this.handleDisconnect)
    if (!device.opened) await device.open()
  }

  async send(data: Uint8Array) {
    if (!this.device || !this.device.opened)
      throw new Error('HID device is not connected')

    const packetSize = this.options.packetSize ?? data.length
    const reportId = this.options.reportId ?? 0

    for (let offset = 0; offset < data.length; offset += packetSize) {
      const chunk = data.slice(offset, offset + packetSize)
      await this.device.sendReport(reportId, chunk)
    }
  }

  async disconnect() {
    if (!this.device) return
    this.device.removeEventListener('inputreport', this.handleInputReport)
    navigator.hid.removeEventListener('disconnect', this.handleDisconnect)
    if (this.device.opened) await this.device.close()
    this.device = undefined
  }

  onMessage(callback: (data: Uint8Array) => void) {
    this.onData = callback
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCb = callback
  }

  isConnected() {
    return !!this.device?.opened
  }
}

export default HidClient
