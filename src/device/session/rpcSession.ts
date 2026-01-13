import { encodeFrame, FLAG_EVENT, FLAG_RESPONSE, type DecodedFrame } from '../protocol/frame'
import { FrameStreamDecoder } from '../protocol/streamDecoder'
import type { Transport } from '../transport'

type RpcSessionOptions = {
  defaultTimeoutMs?: number
}

type InFlight = {
  resolve: (frame: DecodedFrame) => void
  reject: (error: Error) => void
  timeoutId: number
}

export class RpcSession {
  private readonly decoder = new FrameStreamDecoder()
  private readonly inFlight = new Map<number, InFlight>()
  private readonly eventHandlers = new Set<(frame: DecodedFrame) => void>()

  private isStarted = false
  private unsubscribeBytes: (() => void) | null = null
  private nextReqId = 1

  constructor(
    private readonly transport: Transport,
    private readonly options: RpcSessionOptions = {},
  ) {}

  async start() {
    if (this.isStarted) return
    await this.transport.connect()
    this.unsubscribeBytes = this.transport.onBytes((chunk) => this.onBytes(chunk))
    this.isStarted = true
  }

  async stop() {
    if (!this.isStarted) return

    this.unsubscribeBytes?.()
    this.unsubscribeBytes = null

    for (const [, entry] of this.inFlight) {
      clearTimeout(entry.timeoutId)
      entry.reject(new Error('Disconnected'))
    }
    this.inFlight.clear()

    await this.transport.disconnect()
    this.isStarted = false
  }

  onEvent(handler: (frame: DecodedFrame) => void) {
    this.eventHandlers.add(handler)
    return () => this.eventHandlers.delete(handler)
  }

  async request(
    msgId: number,
    payload: Uint8Array,
    options: { timeoutMs?: number; expectResponse?: boolean } = {},
  ) {
    if (!this.isStarted) throw new Error('Session not started')
    const expectResponse = options.expectResponse !== false
    const reqId = expectResponse ? this.allocateReqId() : undefined
    const flags = expectResponse ? FLAG_RESPONSE : 0

    const raw = encodeFrame({ msgId, flags, reqId, payload })
    if (!expectResponse) {
      await this.transport.write(raw)
      return undefined
    }

    const timeoutMs =
      typeof options.timeoutMs === 'number'
        ? options.timeoutMs
        : typeof this.options.defaultTimeoutMs === 'number'
          ? this.options.defaultTimeoutMs
          : 2_000

    const promise = new Promise<DecodedFrame>((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        this.inFlight.delete(reqId!)
        reject(new Error(`Timeout waiting for response (msg_id=0x${msgId.toString(16)}, req_id=${reqId})`))
      }, timeoutMs)
      this.inFlight.set(reqId!, { resolve, reject, timeoutId })
    })

    try {
      await this.transport.write(raw)
    } catch (e) {
      const entry = this.inFlight.get(reqId!)
      if (entry) clearTimeout(entry.timeoutId)
      this.inFlight.delete(reqId!)
      throw e
    }
    return await promise
  }

  private allocateReqId() {
    for (let i = 0; i < 0x1_0000; i++) {
      const candidate = this.nextReqId & 0xffff
      this.nextReqId = (candidate + 1) & 0xffff
      if (candidate === 0) continue
      if (!this.inFlight.has(candidate)) return candidate
    }
    throw new Error('Too many in-flight requests')
  }

  private onBytes(chunk: Uint8Array) {
    const frames = this.decoder.push(chunk)
    for (const frame of frames) {
      if (frame.flags & FLAG_EVENT) {
        for (const handler of this.eventHandlers) handler(frame)
        continue
      }

      if (frame.flags & FLAG_RESPONSE) {
        if (typeof frame.reqId !== 'number') continue
        const entry = this.inFlight.get(frame.reqId)
        if (!entry) continue
        this.inFlight.delete(frame.reqId)
        clearTimeout(entry.timeoutId)
        entry.resolve(frame)
      }
    }
  }
}
