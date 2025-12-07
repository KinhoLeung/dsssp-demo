import { type DeviceClient, type TransportType } from './types'

class MockClient implements DeviceClient {
  readonly transport: TransportType = 'mock'

  label = 'Mock Device'

  private connected = false

  private onData?: (data: Uint8Array) => void

  private onDisconnectCb?: () => void

  async connect() {
    this.connected = true
  }

  async send(data: Uint8Array) {
    if (!this.connected) throw new Error('Mock device is not connected')
    // Echo back the payload so the UI can exercise the receive path.
    setTimeout(() => this.onData?.(data), 30)
  }

  async disconnect() {
    this.connected = false
    this.onDisconnectCb?.()
  }

  onMessage(callback: (data: Uint8Array) => void) {
    this.onData = callback
  }

  onDisconnect(callback: () => void) {
    this.onDisconnectCb = callback
  }

  isConnected() {
    return this.connected
  }
}

export default MockClient
