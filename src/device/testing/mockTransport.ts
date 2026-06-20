import type { Transport, TransportKind, TransportOnBytes } from '../transport'

export type MockTransport = Transport & {
  readonly writes: Uint8Array[]
  emitBytes(bytes: Uint8Array): void
  failNextWrite(error?: Error): void
  clearWrites(): void
}

export const createMockTransport = (kind: TransportKind = 'hid'): MockTransport => {
  const handlers = new Set<TransportOnBytes>()
  const writes: Uint8Array[] = []
  let connected = false
  let nextWriteError: Error | null = null

  return {
    kind,
    writes,
    async connect() {
      connected = true
    },
    async disconnect() {
      connected = false
      handlers.clear()
    },
    async write(bytes: Uint8Array) {
      if (!connected) throw new Error(`${kind.toUpperCase()} not connected`)
      if (nextWriteError) {
        const error = nextWriteError
        nextWriteError = null
        throw error
      }
      writes.push(bytes.slice())
    },
    onBytes(handler: TransportOnBytes) {
      handlers.add(handler)
      return () => handlers.delete(handler)
    },
    emitBytes(bytes: Uint8Array) {
      for (const handler of handlers) handler(bytes)
    },
    failNextWrite(error = new Error('Mock transport write failed')) {
      nextWriteError = error
    },
    clearWrites() {
      writes.length = 0
    },
  }
}

