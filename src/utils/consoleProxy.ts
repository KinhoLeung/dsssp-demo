type ConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

const LOG_ENDPOINT = '/__log'
const LEVELS: ConsoleLevel[] = ['log', 'info', 'warn', 'error', 'debug']

const serializeArg = (value: unknown) => {
  if (value == null) return value
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value
  }

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

LEVELS.forEach((level) => {
  const original = console[level].bind(console)
  console[level] = (...args: unknown[]) => {
    original(...args)
    sendLog(level, args)
  }
})
