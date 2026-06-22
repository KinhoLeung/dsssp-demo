import type { webhmi } from '../proto/generated/webhmi'
import { MsgId } from '../proto/msgId'
import { getWebhmiNamespace } from '../proto/webhmi'
import type { DecodedFrame } from '../protocol/frame'
import { RpcSession } from '../session'
import type { Transport } from '../transport'


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
    // 🔴 埋入防伪标志：用于自校验逻辑
    // 必须确保该 Token 字符串字面量出现在最终编译的 JS 中，且未被 Tree-shaking 移除
    const INTEGRITY_TOKEN = 'SEC_VERIFY_V1_TOKEN';

    // 自校验：如果这个函数被外部篡改（例如：client.authVerify = () => true），则 Marker 会消失
    if (import.meta.env.PROD) {
      const fnStr = this.authVerify.toString();
      // 仅检查 Token 是否存在，不再检查代码逻辑细节（如 subtle.verify），避免压缩导致变量重命名后误杀
      if (!fnStr.includes(INTEGRITY_TOKEN)) {
        throw new Error('System Integrity Violation');
      }
    }

    try {
      // 1. Generate Ephemeral Key Pair (ECDH P-256)
      const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        ['deriveBits']
      )

      // 2. Export Client Pub Key (Raw) -> 65 bytes (0x04 + X + Y)
      const clientPubRaw = await crypto.subtle.exportKey('raw', keyPair.publicKey)
      const clientPubBytes = new Uint8Array(clientPubRaw)
      // Protocol requires Raw X||Y (64 bytes), stripping 0x04 header
      const clientPubSimple = clientPubBytes.length === 65 ? clientPubBytes.subarray(1) : clientPubBytes
      if (clientPubSimple.length !== 64) {
        throw new Error(`Unexpected client pubkey length: ${clientPubSimple.length}`)
      }

      // 3. Send Request (Auth)
      console.debug('[WebhmiClient] Sending Auth request (Client Hello)...')
      const frame = await this.session.request(MsgId.Auth, clientPubSimple)
      if (!frame) throw new Error('Auth failed: no response')
      const payload = frame.payload
      console.debug('[WebhmiClient] Received Auth response (Server Hello).')

      // 4. Parse Response (DevicePub(64) + Sig(64))
      if (payload.length !== 128) {
        // Fallback for old protocol? No, enforcing new.
        throw new Error(`Auth response length mismatch. Got ${payload.length}, expected 128`)
      }
      const devicePubSimple = payload.subarray(0, 64)
      const signature = payload.subarray(64) // Raw r||s

      // 5. Verify Signature (ECDSA P-256 over SHA-256(ClientPub || DevicePub))
      const msg = new Uint8Array(128)
      msg.set(clientPubSimple)
      msg.set(devicePubSimple, 64)

      const caKey = await crypto.subtle.importKey(
        'spki',
        publicKeySpkiDer as any,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify']
      )

      console.debug('[WebhmiClient] Verifying Server signature...')
      const sigOk = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' },
        caKey,
        signature as any,
        msg as any
      )
      console.debug('[WebhmiClient] Signature verification:', sigOk ? 'OK' : 'FAILED')
      if (!sigOk) return false

      // 6. Derive Shared Secret
      // Re-add 0x04 prefix to import 'raw' P-256 key
      const devicePubImport = new Uint8Array(65)
      devicePubImport[0] = 0x04
      devicePubImport.set(devicePubSimple, 1)

      const deviceKey = await crypto.subtle.importKey(
        'raw',
        devicePubImport,
        { name: 'ECDH', namedCurve: 'P-256' },
        false,
        []
      )

      const sharedBits = await crypto.subtle.deriveBits(
        { name: 'ECDH', public: deviceKey },
        keyPair.privateKey,
        256
      ) // 32 bytes

      // 7. Derive Session Key & IV
      const masterSecret = new Uint8Array(sharedBits)
      const keyBlockBuf = await crypto.subtle.digest('SHA-256', masterSecret)
      const keyBlock = new Uint8Array(keyBlockBuf) // 32 bytes

      const sessionKeyRaw = keyBlock.subarray(0, 16)
      const sessionBaseIv = keyBlock.subarray(16, 28) // 12 bytes

      const sessionKey = await crypto.subtle.importKey(
        'raw',
        sessionKeyRaw,
        { name: 'AES-CTR' },
        false,
        ['encrypt', 'decrypt']
      )

      // 8. Enable Encryption
      console.info('[WebhmiClient] Handshake successful. Enabling encryption.')
      this.session.enableEncryption(sessionKey, sessionBaseIv)

      return true
    } catch (e) {
      console.error('Auth/Handshake failed:', e)
      return false
    }
  }

  async getDb(options: { timeoutMs?: number } = {}): Promise<webhmi.IDeviceConfig> {
    const mergedDb: webhmi.IDeviceDb = {}
    let deviceId = ''
    let firmwareVersion = ''

    const sectionsToFetch = [
      this.pb.DbSection.SEC_SYSTEM,
      this.pb.DbSection.SEC_MUSIC,
      this.pb.DbSection.SEC_MIC,
      this.pb.DbSection.SEC_REVERB,
      this.pb.DbSection.SEC_ECHO,
      this.pb.DbSection.SEC_MAIN_OUTPUT,
      this.pb.DbSection.SEC_SUB_OUTPUT,
      this.pb.DbSection.SEC_CENTER,
      this.pb.DbSection.SEC_SURROUND,
    ]

    for (const sec of sectionsToFetch) {
      const secRequest = this.pb.GetDbRequest.create({ section: sec })
      const secPayload = this.pb.GetDbRequest.encode(secRequest).finish()
      console.info(`[WebhmiClient] Requesting database section: ${this.pb.DbSection[sec]}...`)
      const secFrame = await this.session.request(MsgId.GetDb, secPayload, { timeoutMs: options.timeoutMs ?? 15_000 })
      if (!secFrame) throw new Error(`No response received for GetDb section ${this.pb.DbSection[sec]}`)

      const secResponse = this.pb.GetDbResponse.decode(secFrame.payload)
      this.logResponse(`GetDbResponse (Section ${this.pb.DbSection[sec]})`, secFrame.payload, this.pb.GetDbResponse)

      if (secResponse.deviceId) deviceId = secResponse.deviceId
      if (secResponse.firmwareVersion) firmwareVersion = secResponse.firmwareVersion

      if (sec === this.pb.DbSection.SEC_SYSTEM && secResponse.system) mergedDb.system = secResponse.system
      else if (sec === this.pb.DbSection.SEC_MUSIC && secResponse.music) mergedDb.music = secResponse.music
      else if (sec === this.pb.DbSection.SEC_MIC && secResponse.mic) mergedDb.mic = secResponse.mic
      else if (sec === this.pb.DbSection.SEC_REVERB && secResponse.reverb) mergedDb.reverb = secResponse.reverb
      else if (sec === this.pb.DbSection.SEC_ECHO && secResponse.echo) mergedDb.echo = secResponse.echo
      else if (sec === this.pb.DbSection.SEC_MAIN_OUTPUT && secResponse.mainOutput) mergedDb.mainOutput = secResponse.mainOutput
      else if (sec === this.pb.DbSection.SEC_SUB_OUTPUT && secResponse.subOutput) mergedDb.subOutput = secResponse.subOutput
      else if (sec === this.pb.DbSection.SEC_CENTER && secResponse.center) mergedDb.center = secResponse.center
      else if (sec === this.pb.DbSection.SEC_SURROUND && secResponse.surround) mergedDb.surround = secResponse.surround
    }

    return this.pb.DeviceConfig.create({
      deviceId,
      firmwareVersion,
      db: mergedDb,
    })
  }

  getDbToObject(message: webhmi.IDeviceConfig, options: { enums?: unknown; longs?: unknown } = {}) {
    const obj = this.pb.DeviceConfig.toObject(message as any, {
      enums: options.enums ?? String,
      longs: options.longs ?? String,
      defaults: false,
      arrays: true,
      objects: true,
      oneofs: true,
    })
    return this.cleanupLogObject(obj)
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
    if (!this.shouldLogProtocolPayloads()) return
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
    if (!this.shouldLogProtocolPayloads()) return
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

      const eventPbType = (this.pb as any)[`${msgName}Request`]

      if (eventPbType) {
        this.logResponse(msgName, payload, eventPbType, true)
      }
    })
  }

  private shouldLogProtocolPayloads() {
    return import.meta.env.DEV || import.meta.env.VITE_PROTOCOL_LOGS === 'true'
  }

  async setEq(request: webhmi.ISetEqRequest) {
    this.logRequest('SetEqRequest', request, this.pb.SetEqRequest)
    const payload = this.pb.SetEqRequest.encode(request).finish()
    await this.session.request(MsgId.SetEq, payload, { expectResponse: false })
  }

  async setSystem(request: webhmi.ISetSystemRequest) {
    this.logRequest('SetSystemRequest', request, this.pb.SetSystemRequest)
    const payload = this.pb.SetSystemRequest.encode(request).finish()
    const expectResponse = this.shouldExpectSetSystemResponse(request)
    const frame = await this.session.request(MsgId.SetSystem, payload, { expectResponse })
    if (!expectResponse) return
    if (!frame) throw new Error('SetSystem failed: no response')
    if (frame.payload.length > 0) this.logResponse('SetSystemResponse', frame.payload, this.pb.SetSystemRequest)
  }

  private shouldExpectSetSystemResponse(request: webhmi.ISetSystemRequest) {
    return (
      request.bleName !== undefined ||
      request.panelLock !== undefined ||
      Object.prototype.hasOwnProperty.call(request, 'modeList') ||
      request.controlMode !== undefined ||
      request.sceneMode !== undefined
    )
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

  async saveMode(request: webhmi.ISaveModeRequest) {
    this.logRequest('SaveModeRequest', request, this.pb.SaveModeRequest)
    const payload = this.pb.SaveModeRequest.encode(request).finish()
    await this.session.request(MsgId.SaveMode, payload)
  }

  async resetEq(request: webhmi.IResetEqRequest) {
    this.logRequest('ResetEqRequest', request, this.pb.ResetEqRequest)
    const payload = this.pb.ResetEqRequest.encode(request).finish()
    await this.session.request(MsgId.ResetEq, payload)
  }

}
