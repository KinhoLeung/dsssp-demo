export type TransportType = 'hid' | 'ble' | 'mock'

export type DeviceStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type DeviceLogEntry = {
  direction: 'tx' | 'rx' | 'info' | 'error'
  message: string
  ts: number
}

export interface DeviceClient {
  readonly transport: TransportType
  readonly label: string
  connect(): Promise<void>
  disconnect(): Promise<void>
  send(data: Uint8Array): Promise<void>
  onMessage(callback: (data: Uint8Array) => void): void
  onDisconnect(callback: () => void): void
  isConnected(): boolean
}
