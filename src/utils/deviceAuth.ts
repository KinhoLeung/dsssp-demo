export const CMD_AUTH_CHALLENGE = 0xa0
export const CMD_AUTH_RESPONSE = 0xa1
export const AUTH_NONCE_LEN = 32
export const AUTH_BOARD_ID_LEN = 8
export const AUTH_SIGNATURE_LEN = 64

let cachedPublicKey: CryptoKey | null = null

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

const formatBoardId = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export type VerifyResult = {
  ok: boolean
  boardId?: string
  error?: string
}

export const verifyAuthResponse = async (
  nonce: Uint8Array,
  response: Uint8Array
): Promise<VerifyResult> => {
  if (!response.length || response[0] !== CMD_AUTH_RESPONSE) {
    return { ok: false, error: 'Invalid auth response command' }
  }
  if (
    response.length <
    1 + AUTH_BOARD_ID_LEN + 1 + AUTH_SIGNATURE_LEN
  ) {
    return { ok: false, error: 'Auth response too short' }
  }

  const boardIdBytes = response.slice(1, 1 + AUTH_BOARD_ID_LEN)
  const sigLen = response[1 + AUTH_BOARD_ID_LEN]
  if (sigLen < AUTH_SIGNATURE_LEN) {
    return { ok: false, error: 'Auth signature length invalid' }
  }

  const sigStart = 1 + AUTH_BOARD_ID_LEN + 1
  const sigEnd = sigStart + AUTH_SIGNATURE_LEN
  if (response.length < sigEnd) {
    return { ok: false, error: 'Auth signature truncated' }
  }

  try {
    const key = await getPublicKey()
    const signatureRaw = response.slice(sigStart, sigEnd)
    const r = signatureRaw.slice(0, AUTH_SIGNATURE_LEN / 2)
    const s = signatureRaw.slice(AUTH_SIGNATURE_LEN / 2)
    const derSignature = encodeDerSignature(r, s)

    // 首先按 DER 尝试（符合 WebCrypto 规范）
    let verified = false
    try {
      verified = await crypto.subtle.verify(
        {
          name: 'ECDSA',
          hash: { name: 'SHA-256' }
        },
        key,
        derSignature,
        nonce
      )
    } catch {
      verified = false
    }

    // 某些实现（或兼容层）可能接受 raw r||s 形式，做一次回退尝试
    if (!verified) {
      try {
        verified = await crypto.subtle.verify(
          {
            name: 'ECDSA',
            hash: { name: 'SHA-256' }
          },
          key,
          signatureRaw,
          nonce
        )
      } catch {
        // ignore and fall through to error
      }
    }

    if (!verified) {
      return { ok: false, error: 'Signature verification failed' }
    }

    return {
      ok: true,
      boardId: formatBoardId(boardIdBytes)
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error)
    return { ok: false, error: message }
  }
}
