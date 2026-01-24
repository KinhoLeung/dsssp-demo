import type { webhmi } from '../proto/generated/webhmi'
import { MsgId } from '../proto/msgId'
import { getWebhmiNamespace } from '../proto/webhmi'
import { RpcSession } from '../session'
import type { Transport } from '../transport'
import type { DecodedFrame } from '../protocol/frame'

function concatBytes(a: Uint8Array, b: Uint8Array) {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

function derEncodeInteger(bytes: Uint8Array) {
  let start = 0
  while (start < bytes.length && bytes[start] === 0) start++
  const trimmed = bytes.subarray(start)
  const needsLeadingZero = trimmed.length > 0 && trimmed[0] > 0x7f
  const value = needsLeadingZero ? concatBytes(new Uint8Array([0]), trimmed) : trimmed.length ? trimmed : new Uint8Array([0])

  const out = new Uint8Array(2 + value.length)
  out[0] = 0x02
  out[1] = value.length
  out.set(value, 2)
  return out
}

function rawP256SigToDer(raw: Uint8Array) {
  if (raw.length !== 64) throw new Error('Expected raw P-256 signature (64 bytes)')
  const r = raw.subarray(0, 32)
  const s = raw.subarray(32, 64)

  const rDer = derEncodeInteger(r)
  const sDer = derEncodeInteger(s)
  const seqLen = rDer.length + sDer.length

  const out = new Uint8Array(2 + seqLen)
  out[0] = 0x30
  out[1] = seqLen
  out.set(rDer, 2)
  out.set(sDer, 2 + rDer.length)
  return out
}

export class WebhmiClient {
  private readonly session: RpcSession
  private readonly pb = getWebhmiNamespace()

  constructor(transport: Transport, options: { defaultTimeoutMs?: number } = {}) {
    this.session = new RpcSession(transport, { defaultTimeoutMs: options.defaultTimeoutMs })
    this.setupAutoLogging()
  }

  onEvent(handler: (frame: DecodedFrame) => void) {
    return this.session.onEvent(handler)
  }

  async connect() {
    await this.session.start()
  }

  async disconnect() {
    await this.session.stop()
  }

  async authVerify(publicKeySpkiDer: Uint8Array) {
    const nonce = new Uint8Array(32)
    crypto.getRandomValues(nonce)

    const frame = await this.session.request(MsgId.Auth, nonce)
    const payload = frame.payload
    if (payload.length < 1) throw new Error('Auth response too short')

    const sigLen = payload[0]
    const signature = payload.subarray(1, 1 + sigLen)
    if (signature.length !== sigLen) throw new Error('Auth signature truncated')

    const key = await crypto.subtle.importKey(
      'spki',
      publicKeySpkiDer,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['verify'],
    )

    const rawOk = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      signature,
      nonce,
    )
    if (rawOk) return true

    if (signature.length === 64) {
      const der = rawP256SigToDer(signature)
      return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, der, nonce)
    }

    return false
  }

  async getDb(options: { timeoutMs?: number } = {}): Promise<webhmi.GetDbResponse> {
    const payload = this.pb.GetDbRequest?.encode?.({})?.finish?.() ?? new Uint8Array()
    const frame = await this.session.request(MsgId.GetDb, payload, { timeoutMs: options.timeoutMs ?? 15_000 })
    if (!frame) throw new Error('No response received for GetDb')
    this.logResponse('GetDbResponse', frame.payload, this.pb.GetDbResponse)
    return this.pb.GetDbResponse.decode(frame.payload)
  }

  getDbToObject(message: webhmi.GetDbResponse, options: { enums?: unknown; longs?: unknown } = {}) {
    return this.pb.GetDbResponse.toObject(message, {
      enums: options.enums ?? String,
      longs: options.longs ?? String,
      defaults: false,
      arrays: true,
      objects: true,
      oneofs: true,
    })
  }

  private cleanupLogObject(obj: any): any {
    if (Array.isArray(obj)) return obj.map((v) => this.cleanupLogObject(v))
    if (obj !== null && typeof obj === 'object') {
      const out: any = {}
      for (const [k, v] of Object.entries(obj)) {
        if (k.startsWith('_')) continue
        out[k] = this.cleanupLogObject(v)
      }
      return out
    }
    return obj
  }

  private logRequest(name: string, request: any, pbType: any) {
    if (!pbType || !request) return
    try {
      const message = pbType.fromObject(request)
      const rawPretty = pbType.toObject(message, {
        enums: String,
        longs: String,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true,
      })
      const prettyObject = this.cleanupLogObject(rawPretty)
      console.info(`[web:tx] ${name}:`, prettyObject)
    } catch (e) {
      console.info(`[web:tx] ${name} failed to pretty-print:`, e instanceof Error ? e.message : String(e))
    }
  }

  private logResponse(name: string, payload: Uint8Array, pbType: any, isEvent = false) {
    if (!pbType) return
    try {
      const message = pbType.decode(payload)
      const rawPretty = pbType.toObject(message, {
        enums: String,
        longs: String,
        defaults: false,
        arrays: true,
        objects: true,
        oneofs: true,
      })
      const prettyObject = this.cleanupLogObject(rawPretty)
      console.info(`[web:rx] ${isEvent ? 'EVENT ' : ''}${name}:`, prettyObject)
    } catch (e) {
      console.info(`[web:rx] ${name} failed to decode:`, e instanceof Error ? e.message : String(e))
    }
  }

  private setupAutoLogging() {
    this.session.onEvent((frame) => {
      const { msgId, payload } = frame
      const msgName = MsgId[msgId]
      if (!msgName) return

      const requestPbType = (this.pb as any)[`${msgName}Request`]
      if (requestPbType) {
        this.logResponse(msgName, payload, requestPbType, true)
      }
    })
  }

  async setEq(request: webhmi.ISetEqRequest) {
    this.logRequest('SetEqRequest', request, this.pb.SetEqRequest)
    const payload = this.pb.SetEqRequest.encode(request).finish()
    await this.session.request(MsgId.SetEq, payload, { expectResponse: false })
  }

  async setSystem(request: webhmi.ISetSystemRequest) {
    this.logRequest('SetSystemRequest', request, this.pb.SetSystemRequest)
    const payload = this.pb.SetSystemRequest.encode(request).finish()
    await this.session.request(MsgId.SetSystem, payload)
  }

  async setMusic(request: webhmi.ISetMusicRequest) {
    this.logRequest('SetMusicRequest', request, this.pb.SetMusicRequest)
    const payload = this.pb.SetMusicRequest.encode(request).finish()
    await this.session.request(MsgId.SetMusic, payload, { expectResponse: false })
  }

  async setMic(request: webhmi.ISetMicRequest) {
    this.logRequest('SetMicRequest', request, this.pb.SetMicRequest)
    const payload = this.pb.SetMicRequest.encode(request).finish()
    await this.session.request(MsgId.SetMic, payload, { expectResponse: false })
  }

  async setReverb(request: webhmi.ISetReverbRequest) {
    this.logRequest('SetReverbRequest', request, this.pb.SetReverbRequest)
    const payload = this.pb.SetReverbRequest.encode(request).finish()
    await this.session.request(MsgId.SetReverb, payload, { expectResponse: false })
  }

  async setEcho(request: webhmi.ISetEchoRequest) {
    this.logRequest('SetEchoRequest', request, this.pb.SetEchoRequest)
    const payload = this.pb.SetEchoRequest.encode(request).finish()
    await this.session.request(MsgId.SetEcho, payload, { expectResponse: false })
  }

  async setMainOutput(request: webhmi.ISetMainOutputRequest) {
    this.logRequest('SetMainOutputRequest', request, this.pb.SetMainOutputRequest)
    const payload = this.pb.SetMainOutputRequest.encode(request).finish()
    await this.session.request(MsgId.SetMainOutput, payload, { expectResponse: false })
  }

  async setSubOutput(request: webhmi.ISetSubOutputRequest) {
    this.logRequest('SetSubOutputRequest', request, this.pb.SetSubOutputRequest)
    const payload = this.pb.SetSubOutputRequest.encode(request).finish()
    await this.session.request(MsgId.SetSubOutput, payload, { expectResponse: false })
  }

  async setCenter(request: webhmi.ISetCenterRequest) {
    this.logRequest('SetCenterRequest', request, this.pb.SetCenterRequest)
    const payload = this.pb.SetCenterRequest.encode(request).finish()
    await this.session.request(MsgId.SetCenter, payload, { expectResponse: false })
  }

  async setSurround(request: webhmi.ISetSurroundRequest) {
    this.logRequest('SetSurroundRequest', request, this.pb.SetSurroundRequest)
    const payload = this.pb.SetSurroundRequest.encode(request).finish()
    await this.session.request(MsgId.SetSurround, payload, { expectResponse: false })
  }

  async switchCurrentMode(request: webhmi.ISwitchCurrentModeRequest): Promise<webhmi.ISwitchCurrentModeResponse> {
    this.logRequest('SwitchCurrentModeRequest', request, this.pb.SwitchCurrentModeRequest)
    const payload = this.pb.SwitchCurrentModeRequest.encode(request).finish()
    const frame = await this.session.request(MsgId.SwitchCurrentMode, payload)
    if (frame.payload.length === 0) return {}
    this.logResponse('SwitchCurrentModeResponse', frame.payload, this.pb.SwitchCurrentModeResponse)
    return this.pb.SwitchCurrentModeResponse.decode(frame.payload)
  }

  async saveMode(request: webhmi.ISaveModeRequest) {
    this.logRequest('SaveModeRequest', request, this.pb.SaveModeRequest)
    const payload = this.pb.SaveModeRequest.encode(request).finish()
    await this.session.request(MsgId.SaveMode, payload, { expectResponse: false })
  }

  async resetEq(request: webhmi.IResetEqRequest) {
    this.logRequest('ResetEqRequest', request, this.pb.ResetEqRequest)
    const payload = this.pb.ResetEqRequest.encode(request).finish()
    await this.session.request(MsgId.ResetEq, payload, { expectResponse: false })
  }

}
