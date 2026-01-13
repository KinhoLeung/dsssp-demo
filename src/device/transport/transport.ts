export type TransportKind = 'hid' | 'ble'

export type TransportOnBytes = (chunk: Uint8Array) => void

export interface Transport {
  readonly kind: TransportKind
  connect(): Promise<void>
  disconnect(): Promise<void>
  write(bytes: Uint8Array): Promise<void>
  onBytes(handler: TransportOnBytes): () => void
}

