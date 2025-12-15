export const MsgId = {
  System: 0x0000,
  GetCapabilities: 0x0001,
  GetModuleConfig: 0x0002,
  SetModuleConfig: 0x0003,
  SetEq: 0x0004
} as const

export type MsgIdValue = (typeof MsgId)[keyof typeof MsgId]
