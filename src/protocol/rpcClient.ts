/* eslint-disable no-bitwise */

import { FrameFlags } from '../utils/framing'
import type { DecodedFrame } from '../utils/framing'

import type { FramedClient } from './framedClient'

type PendingEntry = {
  resolve: (payload: Uint8Array) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export class RpcClient {
  private pending = new Map<number, PendingEntry>()
  private msgLocks = new Map<number, Promise<void>>()
  private onEventCb?: (frame: DecodedFrame) => void

  constructor(
    private framed: FramedClient,
    private timeoutMs = 5000
  ) {
    framed.onFrame((frame) => this.handleFrame(frame))
  }

  onEvent(cb: (frame: DecodedFrame) => void) {
    this.onEventCb = cb
  }

  resetPending(reason = 'reset') {
    for (const [msgId, entry] of this.pending.entries()) {
      clearTimeout(entry.timer)
      entry.reject(new Error(`RPC 0x${msgId.toString(16)} ${reason}`))
    }
    this.pending.clear()
  }

  private async acquireMsgLock(msgId: number): Promise<() => void> {
    const prev = this.msgLocks.get(msgId)

    let releaseLock!: () => void
    const current = new Promise<void>((resolve) => {
      releaseLock = resolve
    })

    this.msgLocks.set(msgId, current)
    if (prev) await prev

    return () => {
      releaseLock()
      if (this.msgLocks.get(msgId) === current) {
        this.msgLocks.delete(msgId)
      }
    }
  }

  async call(
    msgId: number,
    payload: Uint8Array,
    flags = 0
  ): Promise<Uint8Array> {
    const release = await this.acquireMsgLock(msgId)
    try {
      if (this.pending.has(msgId)) {
        throw new Error(
          `Request 0x${msgId.toString(16)} already pending`
        )
      }

      return await new Promise<Uint8Array>((resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(msgId)
          reject(new Error(`RPC 0x${msgId.toString(16)} timeout`))
        }, this.timeoutMs)

        this.pending.set(msgId, { resolve, reject, timer })

        this.framed
          .sendFrame({ msgId, flags, payload })
          .catch((error: unknown) => {
            clearTimeout(timer)
            this.pending.delete(msgId)
            reject(
              error instanceof Error
                ? error
                : new Error(String(error))
            )
          })
      })
    } finally {
      release()
    }
  }

  async notify(
    msgId: number,
    payload: Uint8Array,
    flags = 0
  ): Promise<void> {
    await this.framed.sendFrame({ msgId, flags, payload })
  }

  private handleFrame(frame: DecodedFrame) {
    if (frame.flags & FrameFlags.EVENT) {
      this.onEventCb?.(frame)
      return
    }

    if (!(frame.flags & FrameFlags.RESPONSE)) {
      return
    }

    const entry = this.pending.get(frame.msgId)
    if (!entry) return

    clearTimeout(entry.timer)
    this.pending.delete(frame.msgId)

    if (frame.flags & FrameFlags.ERROR) {
      entry.reject(new Error('Device returned ERROR frame'))
      return
    }

    entry.resolve(frame.payload)
  }
}
