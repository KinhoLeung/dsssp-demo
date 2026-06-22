import { crc16CcittFalse } from './crc16'

export const MAGIC = new Uint8Array([0xd5, 0x5d])
export const PROTOCOL_VERSION = 0x01

export const FLAG_RESPONSE = 1 << 0
export const FLAG_EVENT = 1 << 1
export const FLAG_ENCRYPTED = 1 << 2

export const FRAME_RESULT_OK = 0x0000

export const FrameResult = {
  OK: 0x0000,
  UNKNOWN_MSG: 0x0001,
  BAD_PAYLOAD: 0x0002,
  INVALID_FIELD: 0x0003,
  VALUE_OUT_OF_RANGE: 0x0004,
  BUSY: 0x0005,
  NOT_AUTHORIZED: 0x0006,
  UNSUPPORTED: 0x0007,
  APPLY_FAILED: 0x0008,
  MODE_LOCKED: 0x0009,
  VERSION_MISMATCH: 0x000a,
  INTERNAL_ERROR: 0x00ff,
} as const

export const frameResultName = (result: number) => {
  for (const [name, value] of Object.entries(FrameResult)) {
    if (value === result) return name
  }
  return `UNKNOWN_RESULT_0x${result.toString(16).padStart(4, '0')}`
}

export type DecodedFrame = {
  ver: number
  msgId: number
  flags: number
  reqId?: number
  ivSync?: number
  result?: number
  payload: Uint8Array
  raw: Uint8Array
}

export type EncodeFrameParams = {
  msgId: number
  flags: number
  reqId?: number
  ivSync?: number
  result?: number
  payload?: Uint8Array
  ver?: number
}

const writeU16Le = (view: DataView, offset: number, value: number) => {
  view.setUint16(offset, value & 0xffff, true)
}

const readU16Le = (view: DataView, offset: number) => view.getUint16(offset, true)

const encodeReqIdExt = (reqId: number) => {
  const ext = new Uint8Array(4)
  ext[0] = 0x80
  ext[1] = 0x02
  ext[2] = reqId & 0xff
  ext[3] = (reqId >>> 8) & 0xff
  return ext
}

const encodeIvSyncExt = (ivSync: number) => {
  const ext = new Uint8Array(6)
  ext[0] = 0x81
  ext[1] = 0x04
  ext[2] = ivSync & 0xff
  ext[3] = (ivSync >>> 8) & 0xff
  ext[4] = (ivSync >>> 16) & 0xff
  ext[5] = (ivSync >>> 24) & 0xff
  return ext
}

const encodeResultExt = (result: number) => {
  const ext = new Uint8Array(4)
  ext[0] = 0x82
  ext[1] = 0x02
  ext[2] = result & 0xff
  ext[3] = (result >>> 8) & 0xff
  return ext
}

const parseU16Ext = (ext: Uint8Array, type: number): number | undefined => {
  let offset = 0
  while (offset + 2 <= ext.length) {
    const t = ext[offset]
    const l = ext[offset + 1]
    offset += 2
    if (offset + l > ext.length) return undefined

    if (t === type && l === 2) {
      return ext[offset] | (ext[offset + 1] << 8)
    }
    offset += l
  }
  return undefined
}

const parseReqIdFromExt = (ext: Uint8Array): number | undefined => parseU16Ext(ext, 0x80)

const parseResultFromExt = (ext: Uint8Array): number | undefined => parseU16Ext(ext, 0x82)

const parseIvSyncFromExt = (ext: Uint8Array): number | undefined => {
  let offset = 0
  while (offset + 2 <= ext.length) {
    const t = ext[offset]
    const l = ext[offset + 1]
    offset += 2
    if (offset + l > ext.length) return undefined

    if (t === 0x81 && l === 4) {
      const v = ext[offset] | (ext[offset + 1] << 8) | (ext[offset + 2] << 16) | (ext[offset + 3] << 24)
      return v >>> 0
    }
    offset += l
  }
  return undefined
}

export const encodeFrame = (params: EncodeFrameParams): Uint8Array => {
  const ver = typeof params.ver === 'number' ? params.ver : PROTOCOL_VERSION
  const payload = params.payload ?? new Uint8Array()
  const extReqId = typeof params.reqId === 'number' ? encodeReqIdExt(params.reqId) : new Uint8Array()
  const extIvSync = typeof params.ivSync === 'number' ? encodeIvSyncExt(params.ivSync) : new Uint8Array()
  const extResult = typeof params.result === 'number' ? encodeResultExt(params.result) : new Uint8Array()

  const extLen = extReqId.length + extIvSync.length + extResult.length
  const hdrLen = 7 + extLen

  const totalLen = 2 + hdrLen + payload.length + 2
  const out = new Uint8Array(totalLen)
  out[0] = MAGIC[0]
  out[1] = MAGIC[1]
  out[2] = ver
  out[3] = hdrLen

  const view = new DataView(out.buffer, out.byteOffset, out.byteLength)
  writeU16Le(view, 4, params.msgId)
  out[6] = params.flags & 0xff
  writeU16Le(view, 7, payload.length)

  // Append Extensions
  out.set(extReqId, 9)
  out.set(extIvSync, 9 + extReqId.length)
  out.set(extResult, 9 + extReqId.length + extIvSync.length)

  out.set(payload, 9 + extLen)

  const crcInput = out.subarray(2, out.length - 2)
  const crc = crc16CcittFalse(crcInput)
  writeU16Le(view, out.length - 2, crc)
  return out
}

export const decodeFrame = (raw: Uint8Array): DecodedFrame => {
  if (raw.length < 2 + 7 + 2) throw new Error('Frame too short')
  if (raw[0] !== MAGIC[0] || raw[1] !== MAGIC[1]) throw new Error('Bad magic')

  const ver = raw[2]
  const hdrLen = raw[3]
  if (hdrLen < 7) throw new Error('Bad hdr_len')

  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const msgId = readU16Le(view, 4)
  const flags = raw[6]
  const payloadLen = readU16Le(view, 7)

  const extLen = hdrLen - 7
  const totalLen = 2 + hdrLen + payloadLen + 2
  if (raw.length !== totalLen) throw new Error('Frame length mismatch')

  const expectedCrc = readU16Le(view, raw.length - 2)
  const crcInput = raw.subarray(2, raw.length - 2)
  const actualCrc = crc16CcittFalse(crcInput)
  if (actualCrc !== expectedCrc) throw new Error('CRC16 mismatch')

  const ext = raw.subarray(9, 9 + extLen)
  const reqId = parseReqIdFromExt(ext)
  const ivSync = parseIvSyncFromExt(ext)
  const result = parseResultFromExt(ext)
  const payload = raw.subarray(9 + extLen, 9 + extLen + payloadLen)

  return { ver, msgId, flags, reqId, ivSync, result, payload, raw }
}
