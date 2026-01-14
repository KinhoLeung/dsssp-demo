type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

const LOG_ENDPOINT = '/__log'
const LEVELS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']

const isErrorLike = (value: unknown): value is { name?: unknown; message?: unknown; stack?: unknown } => {
  if (!value || typeof value !== 'object') return false
  return 'name' in value || 'message' in value || 'stack' in value
}

const serializeError = (value: unknown) => {
  if (!isErrorLike(value)) return null
  const name = typeof value.name === 'string' ? value.name : 'Error'
  const message = typeof value.message === 'string' ? value.message : String(value)
  const stack = typeof value.stack === 'string' ? value.stack : undefined
  return { __type: 'Error', name, message, stack }
}

const serializeArg = (value: unknown) => {
  if (value == null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

  const asError = serializeError(value)
  if (asError) return asError

  try {
    return JSON.parse(JSON.stringify(value))
  } catch {
    return String(value)
  }
}

const sendLog = (level: ConsoleLevel, args: unknown[]) => {
  if (!import.meta.env.DEV) return

  try {
    void fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        level,
        args: args.map(serializeArg),
        ts: Date.now()
      }),
      keepalive: true
    })
  } catch {
    // Ignore log forwarding errors.
  }
}

const shouldCaptureUpdateDepthStack = (args: unknown[]) => {
  for (const arg of args) {
    if (typeof arg !== 'string') continue
    if (arg.includes('Maximum update depth exceeded')) return true
  }
  return false
}

LEVELS.forEach((level) => {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    original(...args)
    if (level === 'error' && shouldCaptureUpdateDepthStack(args)) {
      const stack = new Error('CapturedStack').stack
      sendLog(level, [...args, { __type: 'CapturedStack', stack }])
      return
    }
    sendLog(level, args)
  }
})

if (import.meta.env.DEV) {
  window.addEventListener('error', (event) => {
    const err = event.error ?? new Error(event.message)
    sendLog('error', [{ __type: 'WindowError', message: event.message }, err])
  })

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason
    sendLog('error', [{ __type: 'UnhandledRejection' }, reason])
  })
}
