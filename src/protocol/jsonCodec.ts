const encoder = new TextEncoder()
const decoder = new TextDecoder()

export const encodeJson = (value: unknown): Uint8Array =>
  encoder.encode(JSON.stringify(value))

export const decodeJson = <T = unknown>(bytes: Uint8Array): T => {
  if (!bytes.length) return null as T
  const text = decoder.decode(bytes)
  return JSON.parse(text) as T
}

