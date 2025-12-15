/* eslint-disable no-bitwise */

export const MAGIC0 = 0xd5
export const MAGIC1 = 0x5d
export const PROTO_VER_V1 = 0x01
export const BASE_HDR_LEN = 7
export const MAX_FRAME_LEN = 4096

export const FrameFlags = {
  RESPONSE: 1 << 0,
  EVENT: 1 << 1,
  ERROR: 1 << 2,
  FRAG: 1 << 3,
  ACK_REQ: 1 << 4,
  ACK: 1 << 5
} as const

export type DecodedFrame = {
  ver: number
  hdrLen: number
  msgId: number
  flags: number
  ext: Uint8Array
  payload: Uint8Array
}

const readU16LE = (buf: Uint8Array, offset: number) =>
  buf[offset] | (buf[offset + 1] << 8)

const writeU16LE = (buf: Uint8Array, offset: number, value: number) => {
  buf[offset] = value & 0xff
  buf[offset + 1] = (value >>> 8) & 0xff
}

// CRC16-CCITT-FALSE (poly=0x1021, init=0xFFFF, refin=false, refout=false)
export const crc16CcittFalse = (data: Uint8Array): number => {
  let crc = 0xffff
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) crc = (crc << 1) ^ 0x1021
      else crc <<= 1
      crc &= 0xffff
    }
  }
  return crc & 0xffff
}

export const packFrame = ({
  msgId,
  flags = 0,
  payload = new Uint8Array(0),
  ext = new Uint8Array(0),
  ver = PROTO_VER_V1
}: {
  msgId: number
  flags?: number
  payload?: Uint8Array
  ext?: Uint8Array
  ver?: number
}): Uint8Array => {
  const hdrLen = BASE_HDR_LEN + ext.length
  const frameLen = 2 + hdrLen + payload.length + 2
  const out = new Uint8Array(frameLen)

  out[0] = MAGIC0
  out[1] = MAGIC1
  out[2] = ver
  out[3] = hdrLen
  writeU16LE(out, 4, msgId)
  out[6] = flags
  writeU16LE(out, 7, payload.length)

  if (ext.length) out.set(ext, 9)
  const payloadOffset = 2 + hdrLen
  if (payload.length) out.set(payload, payloadOffset)

  const crcInput = out.slice(2, payloadOffset + payload.length)
  const crc = crc16CcittFalse(crcInput)
  writeU16LE(out, frameLen - 2, crc)

  return out
}

export class FrameDecoder {
  private buffer = new Uint8Array(0)

  reset() {
    this.buffer = new Uint8Array(0)
  }

  feed(chunk: Uint8Array): DecodedFrame[] {
    if (!chunk.length) return []
    const merged = new Uint8Array(this.buffer.length + chunk.length)
    merged.set(this.buffer, 0)
    merged.set(chunk, this.buffer.length)
    this.buffer = merged

    const frames: DecodedFrame[] = []

    while (true) {
      const magicIndex = this.findMagic(this.buffer)
      if (magicIndex < 0) {
        if (this.buffer.length > 1) {
          this.buffer = this.buffer.slice(-1)
        }
        break
      }

      if (magicIndex > 0) {
        this.buffer = this.buffer.slice(magicIndex)
      }

      if (this.buffer.length < 2 + BASE_HDR_LEN) break

      const ver = this.buffer[2]
      const hdrLen = this.buffer[3]
      if (hdrLen < BASE_HDR_LEN) {
        this.buffer = this.buffer.slice(1)
        continue
      }

      const payloadLen = readU16LE(this.buffer, 7)
      const frameLen = 2 + hdrLen + payloadLen + 2
      if (frameLen > MAX_FRAME_LEN) {
        this.buffer = this.buffer.slice(1)
        continue
      }
      if (this.buffer.length < frameLen) break

      const crcExpected = readU16LE(this.buffer, frameLen - 2)
      const crcInput = this.buffer.slice(2, 2 + hdrLen + payloadLen)
      const crcActual = crc16CcittFalse(crcInput)
      if (crcActual !== crcExpected) {
        this.buffer = this.buffer.slice(1)
        continue
      }

      const msgId = readU16LE(this.buffer, 4)
      const flags = this.buffer[6]
      const extLen = hdrLen - BASE_HDR_LEN
      const extStart = 9
      const payloadStart = 2 + hdrLen
      const ext = extLen
        ? this.buffer.slice(extStart, extStart + extLen)
        : new Uint8Array(0)
      const payload = payloadLen
        ? this.buffer.slice(payloadStart, payloadStart + payloadLen)
        : new Uint8Array(0)

      frames.push({
        ver,
        hdrLen,
        msgId,
        flags,
        ext,
        payload
      })

      this.buffer = this.buffer.slice(frameLen)
    }

    return frames
  }

  private findMagic(buf: Uint8Array): number {
    for (let i = 0; i + 1 < buf.length; i++) {
      if (buf[i] === MAGIC0 && buf[i + 1] === MAGIC1) return i
    }
    return -1
  }
}
