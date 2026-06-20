import * as generatedModule from './generated/webhmi'
import type * as generatedWebhmi from './generated/webhmi'

export type GeneratedWebhmiModule = typeof generatedWebhmi

export const getWebhmiNamespace = () => {
  const anyModule = generatedModule as any
  const root = anyModule.default ?? anyModule
  const ns = root.webhmi ?? root
  return ns as any
}
