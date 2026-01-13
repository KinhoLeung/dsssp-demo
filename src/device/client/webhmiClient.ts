import { RpcSession } from '../session'
import type { Transport } from '../transport'
import type { webhmi } from '../proto/generated/webhmi'
import { MsgId } from '../proto/msgId'
import { getWebhmiNamespace } from '../proto/webhmi'

export class WebhmiClient {
  private readonly session: RpcSession
  private readonly pb = getWebhmiNamespace()

  constructor(transport: Transport, options: { defaultTimeoutMs?: number } = {}) {
    this.session = new RpcSession(transport, { defaultTimeoutMs: options.defaultTimeoutMs })
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

  async getDb(): Promise<any> {
    const payload = this.pb.GetDbRequest?.encode?.({})?.finish?.() ?? new Uint8Array()
    const frame = await this.session.request(MsgId.GetDb, payload, { timeoutMs: 8_000 })
    const message = this.pb.GetDbResponse.decode(frame.payload)
    return this.pb.GetDbResponse.toObject(message, {
      enums: String,
      longs: String,
      defaults: false,
      arrays: true,
      objects: true,
      oneofs: true,
    })
  }

  async setEq(request: webhmi.ISetEqRequest) {
    const payload = this.pb.SetEqRequest.encode(request).finish()
    await this.session.request(MsgId.SetEq, payload)
  }

  async setSystem(request: webhmi.ISetSystemRequest) {
    const payload = this.pb.SetSystemRequest.encode(request).finish()
    await this.session.request(MsgId.SetSystem, payload)
  }

  async setMusic(request: webhmi.ISetMusicRequest) {
    const payload = this.pb.SetMusicRequest.encode(request).finish()
    await this.session.request(MsgId.SetMusic, payload)
  }

  async setMic(request: webhmi.ISetMicRequest) {
    const payload = this.pb.SetMicRequest.encode(request).finish()
    await this.session.request(MsgId.SetMic, payload)
  }

  async setReverb(request: webhmi.ISetReverbRequest) {
    const payload = this.pb.SetReverbRequest.encode(request).finish()
    await this.session.request(MsgId.SetReverb, payload)
  }

  async setEcho(request: webhmi.ISetEchoRequest) {
    const payload = this.pb.SetEchoRequest.encode(request).finish()
    await this.session.request(MsgId.SetEcho, payload)
  }

  async setMainOutput(request: webhmi.ISetMainOutputRequest) {
    const payload = this.pb.SetMainOutputRequest.encode(request).finish()
    await this.session.request(MsgId.SetMainOutput, payload)
  }

  async setSubOutput(request: webhmi.ISetSubOutputRequest) {
    const payload = this.pb.SetSubOutputRequest.encode(request).finish()
    await this.session.request(MsgId.SetSubOutput, payload)
  }

  async setCenter(request: webhmi.ISetCenterRequest) {
    const payload = this.pb.SetCenterRequest.encode(request).finish()
    await this.session.request(MsgId.SetCenter, payload)
  }

  async setSurround(request: webhmi.ISetSurroundRequest) {
    const payload = this.pb.SetSurroundRequest.encode(request).finish()
    await this.session.request(MsgId.SetSurround, payload)
  }

  async switchCurrentMode(request: webhmi.ISwitchCurrentModeRequest): Promise<webhmi.ISwitchCurrentModeResponse> {
    const payload = this.pb.SwitchCurrentModeRequest.encode(request).finish()
    const frame = await this.session.request(MsgId.SwitchCurrentMode, payload)
    if (frame.payload.length === 0) return {}
    return this.pb.SwitchCurrentModeResponse.decode(frame.payload)
  }

  async changeModeParam(request: webhmi.IChangeModeParamRequest) {
    const payload = this.pb.ChangeModeParamRequest.encode(request).finish()
    await this.session.request(MsgId.ChangeModeParam, payload)
  }

  async resetEq(request: webhmi.IResetEqRequest) {
    const payload = this.pb.ResetEqRequest.encode(request).finish()
    await this.session.request(MsgId.ResetEq, payload)
  }
}

const rawP256SigToDer = (raw: Uint8Array) => {
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

const derEncodeInteger = (bytes: Uint8Array) => {
  let start = 0
  while (start < bytes.length && bytes[start] === 0) start++
  const trimmed = bytes.subarray(start)
  const needsLeadingZero = trimmed.length > 0 && (trimmed[0] & 0x80) !== 0
  const value = needsLeadingZero ? concatBytes(new Uint8Array([0]), trimmed) : trimmed.length ? trimmed : new Uint8Array([0])

  const out = new Uint8Array(2 + value.length)
  out[0] = 0x02
  out[1] = value.length
  out.set(value, 2)
  return out
}

const concatBytes = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}
