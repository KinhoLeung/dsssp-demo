export const AUTH_NONCE_LEN = 32
export const AUTH_SIGNATURE_LEN = 64
export const AUTH_INFO_TLV_FW_VER = 0x01
export const AUTH_INFO_TLV_DEVICE_ID = 0x10

let cachedPublicKey: CryptoKey | null = null
const utf8Decoder = new TextDecoder()

const base64ToUint8Array = (b64: string): Uint8Array => {
  if (typeof atob === 'undefined') {
    throw new Error('Base64 decoding not available')
  }
  const binary = atob(b64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

const getPublicKey = async (): Promise<CryptoKey> => {
  if (cachedPublicKey) return cachedPublicKey
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('WebCrypto is not available')
  }

  const env = (import.meta as any).env as Record<string, string | undefined>
  const b64 = env.VITE_AUTH_PUBLIC_KEY_B64
  if (!b64) {
    throw new Error('VITE_AUTH_PUBLIC_KEY_B64 is not configured')
  }

  const keyData = base64ToUint8Array(b64)
  const key = await crypto.subtle.importKey(
    'spki',
    keyData,
    {
      name: 'ECDSA',
      namedCurve: 'P-256'
    },
    false,
    ['verify']
  )
  cachedPublicKey = key
  return key
}

const trimLeadingZeros = (bytes: Uint8Array): Uint8Array => {
  let i = 0
  while (i < bytes.length - 1 && bytes[i] === 0x00) {
    i++
  }
  return bytes.slice(i)
}

const encodeDerInteger = (bytes: Uint8Array): Uint8Array => {
  let v = trimLeadingZeros(bytes)
  if (v[0] & 0x80) {
    const prefixed = new Uint8Array(v.length + 1)
    prefixed[0] = 0x00
    prefixed.set(v, 1)
    v = prefixed
  }
  const out = new Uint8Array(2 + v.length)
  out[0] = 0x02
  out[1] = v.length
  out.set(v, 2)
  return out
}

const encodeDerSignature = (r: Uint8Array, s: Uint8Array): Uint8Array => {
  const rEnc = encodeDerInteger(r)
  const sEnc = encodeDerInteger(s)
  const seqLen = rEnc.length + sEnc.length
  const out = new Uint8Array(2 + seqLen)
  out[0] = 0x30
  out[1] = seqLen
  out.set(rEnc, 2)
  out.set(sEnc, 2 + rEnc.length)
  return out
}

const formatDeviceId = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

const parseAuthInfoTlvs = (
  tlvBytes: Uint8Array
): {
  deviceId?: string
  firmwareVersion?: string
} => {
  const out: {
    deviceId?: string
    firmwareVersion?: string
  } = {}

  let i = 0
  while (i + 2 <= tlvBytes.length) {
    const type = tlvBytes[i]
    const len = tlvBytes[i + 1]
    const valueStart = i + 2
    const valueEnd = valueStart + len
    if (valueEnd > tlvBytes.length) break
    const valueBytes = tlvBytes.slice(valueStart, valueEnd)

    if (type === AUTH_INFO_TLV_DEVICE_ID) {
      out.deviceId = formatDeviceId(valueBytes)
    } else {
      const value = utf8Decoder.decode(valueBytes)
      if (type === AUTH_INFO_TLV_FW_VER) out.firmwareVersion = value
    }

    i = valueEnd
  }
  return out
}

export type VerifyResult = {
  ok: boolean
  deviceId?: string
  firmwareVersion?: string
  error?: string
}

export const verifyAuthResponse = async (
  nonce: Uint8Array,
  response: Uint8Array
): Promise<VerifyResult> => {
  if (!response.length) return { ok: false, error: 'Auth response empty' }

  // Format: [sig_len][signature(64)][info_len][info...]
  const baseLen = 1 + AUTH_SIGNATURE_LEN + 1
  if (response.length < baseLen) {
    return { ok: false, error: 'Auth response too short' }
  }
  const sigLen = response[0]
  if (sigLen !== AUTH_SIGNATURE_LEN) {
    return { ok: false, error: 'Auth signature length invalid' }
  }
  const signatureRaw = response.slice(1, 1 + AUTH_SIGNATURE_LEN)
  const infoLen = response[1 + AUTH_SIGNATURE_LEN]
  const infoStart = 1 + AUTH_SIGNATURE_LEN + 1
  const infoEnd = infoStart + infoLen
  if (response.length < infoEnd) {
    return { ok: false, error: 'Auth info truncated' }
  }
  const infoBytes = response.slice(infoStart, infoEnd)

  try {
    const key = await getPublicKey()
    const verifyWith = async (
      message: Uint8Array,
      derSignature: Uint8Array,
      signatureRaw: Uint8Array
    ): Promise<boolean> => {
      // 首先按 DER 尝试（符合 WebCrypto 规范）
      try {
        const ok = await crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
          },
          key,
          derSignature,
          message
        )
        if (ok) return true
      } catch {
        // ignore
      }

      // 某些实现（或兼容层）可能接受 raw r||s 形式，做一次回退尝试
      try {
        return await crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
          },
          key,
          signatureRaw,
          message
        )
      } catch {
        return false
      }
    }

    const r = signatureRaw.slice(0, AUTH_SIGNATURE_LEN / 2)
    const s = signatureRaw.slice(AUTH_SIGNATURE_LEN / 2)
    const derSignature = encodeDerSignature(r, s)

    const signedMessage = new Uint8Array(nonce.length + 1 + infoBytes.length)
    signedMessage.set(nonce, 0)
    signedMessage[nonce.length] = infoLen
    signedMessage.set(infoBytes, nonce.length + 1)

    const verified = await verifyWith(signedMessage, derSignature, signatureRaw)
    if (!verified) return { ok: false, error: 'Signature verification failed' }

    const info = parseAuthInfoTlvs(infoBytes)
    return {
      ok: true,
      deviceId: info.deviceId,
      firmwareVersion: info.firmwareVersion
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}
