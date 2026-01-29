import { encodeFrame, FLAG_EVENT, FLAG_RESPONSE, FLAG_ENCRYPTED, type DecodedFrame } from '../protocol/frame'
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

  private cryptoKey: CryptoKey | null = null
  private sessionBaseIv: Uint8Array | null = null
  private txFrameCounter = 0
  private lastRxFrameCounter = -1
  private processQueue: Promise<void> = Promise.resolve()

  constructor(
    private readonly transport: Transport,
    private readonly options: RpcSessionOptions = {},
  ) { }

  enableEncryption(key: CryptoKey, baseIv: Uint8Array) {
    if (baseIv.length !== 12) throw new Error('Base IV must be 12 bytes')
    this.cryptoKey = key
    this.sessionBaseIv = new Uint8Array(baseIv)
    this.txFrameCounter = 0 // Client range: 0 ~ 0x7FFFFFFF
    this.lastRxFrameCounter = 0x7fffffff // Device range: 0x80000000 ~ 0xFFFFFFFF. Init to 0x7FFFFFFF so first 0x80000000 is accepted.
  }

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
    this.cryptoKey = null
    this.sessionBaseIv = null
    this.txFrameCounter = 0
    this.lastRxFrameCounter = -1
    this.processQueue = Promise.resolve()
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

    // Encryption Logic
    let finalPayload = payload
    let flags = options.expectResponse !== false ? FLAG_RESPONSE : 0
    let ivSync: number | undefined

    if (this.cryptoKey && this.sessionBaseIv && msgId !== 0) {
      flags |= FLAG_ENCRYPTED
      if (this.txFrameCounter >= 0x80000000) {
        throw new Error('Tx FrameCounter overflow (Client range exhausted)')
      }
      ivSync = this.txFrameCounter >>> 0

      // Construct IV: Base(12) + Counter(4 BE)
      const iv = new Uint8Array(16)
      iv.set(this.sessionBaseIv)
      const v = new DataView(iv.buffer)
      v.setUint32(12, ivSync, false)

      console.debug(`[RpcSession] Encrypting msgId=0x${msgId.toString(16)} with ivSync=0x${ivSync.toString(16)}`)
      const cipher = await crypto.subtle.encrypt(
        { name: 'AES-CTR', counter: iv, length: 128 },
        this.cryptoKey,
        payload as any,
      )
      finalPayload = new Uint8Array(cipher)

      // Increment Tx Counter by number of blocks
      const blocksUsed = Math.max(1, Math.ceil(payload.length / 16))
      this.txFrameCounter = (this.txFrameCounter + blocksUsed) >>> 0
    }

    const expectResponse = options.expectResponse !== false
    const reqId = expectResponse ? this.allocateReqId() : undefined

    const raw = encodeFrame({ msgId, flags, reqId, ivSync, payload: finalPayload })
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
      console.debug(`[RpcSession] TX msgId=0x${msgId.toString(16)} flags=${flags} reqId=${reqId} len=${finalPayload.length}`)
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
    this.processQueue = this.processQueue.then(async () => {
      console.debug(`[RpcSession] received chunk, len=${chunk.length}`)
      const frames = this.decoder.push(chunk)
      for (const frame of frames) {
        await this.handleFrame(frame)
      }
    }).catch(e => {
      console.error('[RpcSession] processing error:', e)
    })
  }

  private async handleFrame(frame: DecodedFrame) {
    // Decryption Logic
    if ((frame.flags & FLAG_ENCRYPTED) && this.cryptoKey && this.sessionBaseIv) {
      if (typeof frame.ivSync !== 'number') {
        console.error('[RpcSession] Encrypted frame missing IV_SYNC ext')
        return // Drop
      }

      // Replay Protection
      const ivSyncU32 = frame.ivSync >>> 0

      // Counter Range Check (Must be Device Range: 0x80000000 ~ 0xFFFFFFFF)
      // Note: In JS, bitwise ops are signed 32-bit. 0x80000000 is -2147483648.
      // So checking (ivSyncU32 < 0x80000000) using unsigned comparison logic.
      if (ivSyncU32 < 0x80000000) {
        console.warn(`[RpcSession] Invalid Counter Range (Client Space). Dropping. val=0x${ivSyncU32.toString(16)}`)
        return
      }

      // Replay Protection
      if (ivSyncU32 <= (this.lastRxFrameCounter >>> 0)) {
        console.warn(`[RpcSession] Replay/Old packet detected. Curr=0x${ivSyncU32.toString(16)}, Last=0x${(this.lastRxFrameCounter >>> 0).toString(16)}`)
        return
      }
      this.lastRxFrameCounter = ivSyncU32

      console.debug(`[RpcSession] Decrypting msgId=0x${frame.msgId.toString(16)} with ivSync=0x${ivSyncU32.toString(16)}`)
      try {
        // Construct IV
        const iv = new Uint8Array(16)
        iv.set(this.sessionBaseIv)
        const v = new DataView(iv.buffer)
        v.setUint32(12, frame.ivSync, false)

        const plain = await crypto.subtle.decrypt(
          { name: 'AES-CTR', counter: iv, length: 128 },
          this.cryptoKey,
          frame.payload as any,
        )
        frame.payload = new Uint8Array(plain)

        // Increment Rx Counter by blocks
        const blocksUsed = Math.max(1, Math.ceil(frame.payload.length / 16))
        this.lastRxFrameCounter = (ivSyncU32 + blocksUsed - 1) >>> 0
      } catch (e) {
        console.error('[RpcSession] Decrypt failed:', e)
        return
      }
    }

    console.debug(`[RpcSession] RX msgId=0x${frame.msgId.toString(16)} flags=${frame.flags} reqId=${frame.reqId} len=${frame.payload.length}`)

    if (frame.flags & FLAG_EVENT) {
      for (const handler of this.eventHandlers) handler(frame)
      return
    }

    if (frame.flags & FLAG_RESPONSE) {
      if (typeof frame.reqId !== 'number') return
      const entry = this.inFlight.get(frame.reqId)
      if (!entry) return
      this.inFlight.delete(frame.reqId)
      clearTimeout(entry.timeoutId)
      entry.resolve(frame)
    }
  }
}
