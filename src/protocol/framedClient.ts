import { type DeviceClient } from '../devices/types'
import { FrameDecoder, packFrame, type DecodedFrame } from '../utils/framing'

export type OutgoingFrame = {
  msgId: number
  flags?: number
  payload?: Uint8Array
  ext?: Uint8Array
}

export class FramedClient {
  private decoder = new FrameDecoder()
  private listeners: Array<(frame: DecodedFrame) => void> = []

  constructor(private client: DeviceClient) {}

  attach() {
    this.decoder.reset()
    this.client.onMessage((bytes: Uint8Array) => {
      const frames = this.decoder.feed(bytes)
      for (const frame of frames) {
        for (const listener of this.listeners) listener(frame)
      }
    })
  }

  onFrame(cb: (frame: DecodedFrame) => void) {
    this.listeners.push(cb)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb)
    }
  }

  reset() {
    this.decoder.reset()
  }

  async sendFrame(frame: OutgoingFrame) {
    const payload = frame.payload ?? new Uint8Array(0)
    const ext = frame.ext ?? new Uint8Array(0)
    const flags = frame.flags ?? 0
    await this.client.send(
      packFrame({
        msgId: frame.msgId,
        flags,
        payload,
        ext
      })
    )
  }
}
