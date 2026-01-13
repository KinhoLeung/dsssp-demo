const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder('utf-8', { fatal: false })

export class PbWriter {
  private readonly out: number[] = []

  finish() {
    return Uint8Array.from(this.out)
  }

  tag(fieldNo: number, wireType: number) {
    this.varint32((fieldNo << 3) | wireType)
  }

  varint32(value: number) {
    let v = value >>> 0
    while (v > 0x7f) {
      this.out.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    this.out.push(v)
  }

  varintBig(value: bigint) {
    let v = value
    while (v > 0x7fn) {
      this.out.push(Number(v & 0x7fn) | 0x80)
      v >>= 7n
    }
    this.out.push(Number(v))
  }

  uint32(fieldNo: number, value: number | undefined) {
    if (typeof value !== 'number') return
    this.tag(fieldNo, 0)
    this.varint32(value)
  }

  int32(fieldNo: number, value: number | undefined) {
    if (typeof value !== 'number') return
    this.tag(fieldNo, 0)
    this.varintBig(BigInt.asUintN(64, BigInt(value)))
  }

  bool(fieldNo: number, value: boolean | undefined) {
    if (typeof value !== 'boolean') return
    this.tag(fieldNo, 0)
    this.varint32(value ? 1 : 0)
  }

  float(fieldNo: number, value: number | undefined) {
    if (typeof value !== 'number') return
    this.tag(fieldNo, 5)
    const buf = new ArrayBuffer(4)
    new DataView(buf).setFloat32(0, value, true)
    const bytes = new Uint8Array(buf)
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i])
  }

  string(fieldNo: number, value: string | undefined) {
    if (typeof value !== 'string') return
    const bytes = textEncoder.encode(value)
    this.tag(fieldNo, 2)
    this.varint32(bytes.length)
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i])
  }

  bytes(fieldNo: number, value: Uint8Array | undefined) {
    if (!(value instanceof Uint8Array)) return
    this.tag(fieldNo, 2)
    this.varint32(value.length)
    for (let i = 0; i < value.length; i++) this.out.push(value[i])
  }

  message(fieldNo: number, bytes: Uint8Array | undefined) {
    if (!(bytes instanceof Uint8Array)) return
    this.tag(fieldNo, 2)
    this.varint32(bytes.length)
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i])
  }

  packedVarint32(fieldNo: number, values: number[] | undefined) {
    if (!Array.isArray(values) || values.length === 0) return
    const inner = new PbWriter()
    for (const v of values) inner.varint32(v)
    this.tag(fieldNo, 2)
    const bytes = inner.finish()
    this.varint32(bytes.length)
    for (let i = 0; i < bytes.length; i++) this.out.push(bytes[i])
  }
}

export class PbReader {
  public pos = 0

  constructor(public readonly buf: Uint8Array) {}

  get len() {
    return this.buf.length
  }

  eof() {
    return this.pos >= this.buf.length
  }

  tag() {
    if (this.eof()) return 0
    return this.varint32()
  }

  varint32() {
    const v = this.varintBig()
    return Number(v & 0xffff_ffffn)
  }

  varintBig() {
    let shift = 0n
    let result = 0n

    for (let i = 0; i < 10; i++) {
      if (this.pos >= this.buf.length) throw new Error('Truncated varint')
      const b = this.buf[this.pos++]
      result |= BigInt(b & 0x7f) << shift
      if ((b & 0x80) === 0) return result
      shift += 7n
    }
    throw new Error('Varint too long')
  }

  uint32() {
    return this.varint32() >>> 0
  }

  int32() {
    const v = this.varintBig()
    return Number(BigInt.asIntN(32, v))
  }

  bool() {
    return this.uint32() !== 0
  }

  float() {
    if (this.pos + 4 > this.buf.length) throw new Error('Truncated float')
    const view = new DataView(this.buf.buffer, this.buf.byteOffset + this.pos, 4)
    const value = view.getFloat32(0, true)
    this.pos += 4
    return value
  }

  bytes() {
    const length = this.uint32()
    if (this.pos + length > this.buf.length) throw new Error('Truncated bytes')
    const out = this.buf.subarray(this.pos, this.pos + length)
    this.pos += length
    return out
  }

  string() {
    const bytes = this.bytes()
    return textDecoder.decode(bytes)
  }

  skip(wireType: number) {
    switch (wireType) {
      case 0:
        this.varintBig()
        return
      case 1:
        this.pos += 8
        return
      case 2: {
        const length = this.uint32()
        this.pos += length
        return
      }
      case 5:
        this.pos += 4
        return
      default:
        throw new Error(`Unknown wire type ${wireType}`)
    }
  }
}

export const readPackedVarint32 = (reader: PbReader) => {
  const out: number[] = []
  const bytes = reader.bytes()
  const inner = new PbReader(bytes)
  while (!inner.eof()) out.push(inner.uint32())
  return out
}

