import type { Transport, TransportOnBytes } from './transport'

type HidTransportOptions = {
  reportId: number
  reportSize: number
}

export class HidTransport implements Transport {
  public readonly kind = 'hid' as const

  private readonly handlers = new Set<TransportOnBytes>()
  private isConnected = false

  private readonly onInputReport = (event: HIDInputReportEvent) => {
    const view = event.data
    let chunk = new Uint8Array(view.buffer, view.byteOffset, view.byteLength)
    if (chunk.length === this.options.reportSize + 1 && chunk[0] === event.reportId) {
      chunk = chunk.subarray(1)
    } else if (chunk.length > this.options.reportSize) {
      chunk = chunk.subarray(0, this.options.reportSize)
    }
    for (const handler of this.handlers) handler(chunk)
  }

  constructor(
    private readonly device: HIDDevice,
    private readonly options: HidTransportOptions,
  ) {}

  async connect() {
    if (this.isConnected) return
    await this.device.open()
    this.device.addEventListener('inputreport', this.onInputReport)
    this.isConnected = true
  }

  async disconnect() {
    if (!this.isConnected) return
    this.device.removeEventListener('inputreport', this.onInputReport)
    await this.device.close()
    this.isConnected = false
  }

  async write(bytes: Uint8Array) {
    if (!this.isConnected) throw new Error('HID not connected')
    const reportSize = this.options.reportSize
    const { reportId } = this.options

    for (let offset = 0; offset < bytes.length; offset += reportSize) {
      const chunk = bytes.subarray(offset, Math.min(offset + reportSize, bytes.length))
      const report = new Uint8Array(reportSize)
      report.set(chunk)
      await this.device.sendReport(reportId, report)
    }
  }

  onBytes(handler: TransportOnBytes) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}
