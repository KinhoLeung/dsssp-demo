import { RpcSession } from '../session'
import type { Transport } from '../transport'
import {
  decodeGetDbResponse,
  decodeSwitchCurrentModeResponse,
  encodeChangeModeParamRequest,
  encodeGetDbRequest,
  encodeResetEqRequest,
  encodeSetCenterRequest,
  encodeSetEchoRequest,
  encodeSetEqRequest,
  encodeSetMainOutputRequest,
  encodeSetMicRequest,
  encodeSetMusicRequest,
  encodeSetReverbRequest,
  encodeSetSubOutputRequest,
  encodeSetSurroundRequest,
  encodeSetSystemRequest,
  encodeSwitchCurrentModeRequest,
  MsgId,
  type ChangeModeParamRequest,
  type GetDbResponse,
  type ResetEqRequest,
  type SetCenterRequest,
  type SetEchoRequest,
  type SetEqRequest,
  type SetMainOutputRequest,
  type SetMicRequest,
  type SetMusicRequest,
  type SetReverbRequest,
  type SetSubOutputRequest,
  type SetSurroundRequest,
  type SetSystemRequest,
  type SwitchCurrentModeRequest,
  type SwitchCurrentModeResponse,
} from '../proto/webhmi'

export class WebhmiClient {
  private readonly session: RpcSession

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

  async getDb(): Promise<GetDbResponse> {
    const frame = await this.session.request(MsgId.GetDb, encodeGetDbRequest({}))
    return decodeGetDbResponse(frame.payload)
  }

  async setEq(request: SetEqRequest) {
    await this.session.request(MsgId.SetEq, encodeSetEqRequest(request))
  }

  async setSystem(request: SetSystemRequest) {
    await this.session.request(MsgId.SetSystem, encodeSetSystemRequest(request))
  }

  async setMusic(request: SetMusicRequest) {
    await this.session.request(MsgId.SetMusic, encodeSetMusicRequest(request))
  }

  async setMic(request: SetMicRequest) {
    await this.session.request(MsgId.SetMic, encodeSetMicRequest(request))
  }

  async setReverb(request: SetReverbRequest) {
    await this.session.request(MsgId.SetReverb, encodeSetReverbRequest(request))
  }

  async setEcho(request: SetEchoRequest) {
    await this.session.request(MsgId.SetEcho, encodeSetEchoRequest(request))
  }

  async setMainOutput(request: SetMainOutputRequest) {
    await this.session.request(MsgId.SetMainOutput, encodeSetMainOutputRequest(request))
  }

  async setSubOutput(request: SetSubOutputRequest) {
    await this.session.request(MsgId.SetSubOutput, encodeSetSubOutputRequest(request))
  }

  async setCenter(request: SetCenterRequest) {
    await this.session.request(MsgId.SetCenter, encodeSetCenterRequest(request))
  }

  async setSurround(request: SetSurroundRequest) {
    await this.session.request(MsgId.SetSurround, encodeSetSurroundRequest(request))
  }

  async switchCurrentMode(request: SwitchCurrentModeRequest): Promise<SwitchCurrentModeResponse> {
    const frame = await this.session.request(MsgId.SwitchCurrentMode, encodeSwitchCurrentModeRequest(request))
    if (frame.payload.length === 0) return {}
    return decodeSwitchCurrentModeResponse(frame.payload)
  }

  async changeModeParam(request: ChangeModeParamRequest) {
    await this.session.request(MsgId.ChangeModeParam, encodeChangeModeParamRequest(request))
  }

  async resetEq(request: ResetEqRequest) {
    await this.session.request(MsgId.ResetEq, encodeResetEqRequest(request))
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

