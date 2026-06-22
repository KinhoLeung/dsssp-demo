type Translate = (key: string, options?: Record<string, unknown>) => string

const RESULT_PATTERN = /result=([A-Z0-9_]+)/

const normalizeResultName = (name: string) => name.toLowerCase()

export const extractRpcResultName = (message: string) => {
  const match = RESULT_PATTERN.exec(message)
  return match?.[1] ?? ''
}

export const formatDeviceErrorMessage = (error: unknown, t: Translate) => {
  const rawMessage = error instanceof Error ? error.message : String(error ?? '')
  if (!rawMessage) return ''

  const resultName = extractRpcResultName(rawMessage)
  if (!resultName) return rawMessage

  return t(`deviceErrors.result.${normalizeResultName(resultName)}`, {
    defaultValue: t('deviceErrors.result.unknown', {
      result: resultName,
      defaultValue: rawMessage,
    }),
  })
}
