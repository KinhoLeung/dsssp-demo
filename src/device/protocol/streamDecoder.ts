import { decodeFrame, MAGIC } from './frame'

const concat = (a: Uint8Array, b: Uint8Array) => {
  if (a.length === 0) return b.slice()
  const out = new Uint8Array(a.length + b.length)
  out.set(a)
  out.set(b, a.length)
  return out
}

const indexOfMagic = (buf: Uint8Array) => {
  for (let i = 0; i + 1 < buf.length; i++) {
    if (buf[i] === MAGIC[0] && buf[i + 1] === MAGIC[1]) return i
  }
  return -1
}

export class FrameStreamDecoder {
  private buffer = new Uint8Array()

  push(chunk: Uint8Array) {
    if (chunk.length === 0) return []
    this.buffer = concat(this.buffer, chunk)

    const frames = []
    while (true) {
      const start = indexOfMagic(this.buffer)
      if (start < 0) {
        this.buffer = this.buffer.length > 1 ? this.buffer.subarray(this.buffer.length - 1) : this.buffer
        break
      }

      if (start > 0) this.buffer = this.buffer.subarray(start)
      if (this.buffer.length < 4) break

      const hdrLen = this.buffer[3]
      if (hdrLen < 7) {
        this.buffer = this.buffer.subarray(1)
        continue
      }

      if (this.buffer.length < 9) break
      const payloadLen = this.buffer[7] | (this.buffer[8] << 8)
      const totalLen = 2 + hdrLen + payloadLen + 2
      if (this.buffer.length < totalLen) break

      const raw = this.buffer.subarray(0, totalLen)
      try {
        frames.push(decodeFrame(raw))
        this.buffer = this.buffer.subarray(totalLen)
      } catch {
        this.buffer = this.buffer.subarray(1)
      }
    }

    return frames
  }
}
