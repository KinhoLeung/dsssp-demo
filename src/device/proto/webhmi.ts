import * as generatedModule from './generated/webhmi'

export type GeneratedWebhmiModule = typeof import('./generated/webhmi')

export const getWebhmiNamespace = () => {
  const anyModule = generatedModule as any
  const root = anyModule.default ?? anyModule
  const ns = root.webhmi ?? root
  return ns as any
}

