export const MsgId = {
  Auth: 0x0000,
  getCapabilities: 0x0001,

} as const

export type MsgIdValue = (typeof MsgId)[keyof typeof MsgId]
