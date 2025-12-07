import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import deviceConfig from '../configs/device'
import BleClient from '../devices/bleClient'
import HidClient from '../devices/hidClient'
import MockClient from '../devices/mockClient'
import {
  type DeviceClient,
  type DeviceLogEntry,
  type DeviceStatus,
  type TransportType
} from '../devices/types'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const toHex = (data: Uint8Array) =>
  Array.from(data)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join(' ')

const describePayload = (data: Uint8Array) => {
  if (!data.length) return '0 bytes'
  let text = ''
  try {
    text = decoder.decode(data)
  } catch {
    text = ''
  }

  const printable =
    text &&
    [...text].every((char) => {
      const code = char.charCodeAt(0)
      return (
        (code >= 0x20 && code <= 0x7e) ||
        code === 0x09 ||
        code === 0x0a ||
        code === 0x0d
      )
    })

  if (printable && text.length <= 120) return `${data.length} bytes "${text}"`

  const shortened = toHex(data.slice(0, 16))
  return `${data.length} bytes [${shortened}${data.length > 16 ? ' …' : ''}]`
}

const useDeviceLink = () => {
  const [client, setClient] = useState<DeviceClient | null>(null)
  const [status, setStatus] = useState<DeviceStatus>('idle')
  const [deviceName, setDeviceName] = useState('')
  const [lastError, setLastError] = useState<string>('')
  const [logs, setLogs] = useState<DeviceLogEntry[]>([])
  const lastTransport = useRef<TransportType | null>(null)

  const pushLog = useCallback((entry: DeviceLogEntry) => {
    setLogs((prev) => [...prev.slice(-40), entry])
  }, [])

  const attachReader = useCallback(
    (nextClient: DeviceClient) => {
      nextClient.onMessage((data: Uint8Array) => {
        pushLog({
          direction: 'rx',
          message: describePayload(data),
          ts: Date.now()
        })
      })
    },
    [pushLog]
  )

  const attachDisconnect = useCallback(
    (nextClient: DeviceClient) => {
      nextClient.onDisconnect(() => {
        setClient(null)
        setStatus('idle')
        setDeviceName('')
        pushLog({
          direction: 'info',
          message: 'Device disconnected',
          ts: Date.now()
        })
      })
    },
    [pushLog]
  )

  const connectWithClient = useCallback(
    async (factory: () => DeviceClient) => {
      if (client) await client.disconnect()
      setStatus('connecting')
      setLastError('')

      try {
        const nextClient = factory()
        await nextClient.connect()
        attachReader(nextClient)
        attachDisconnect(nextClient)
        setClient(nextClient)
        setDeviceName(nextClient.label)
        setStatus('connected')
        lastTransport.current = nextClient.transport

        pushLog({
          direction: 'info',
          message: `Connected via ${nextClient.transport}`,
          ts: Date.now()
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setStatus('error')
        setLastError(message)
        pushLog({ direction: 'error', message, ts: Date.now() })
      }
    },
    [attachReader, client, pushLog]
  )

  const connectHid = useCallback(
    () => connectWithClient(() => new HidClient(deviceConfig.hid)),
    [connectWithClient]
  )

  const connectBle = useCallback(
    () => connectWithClient(() => new BleClient(deviceConfig.ble)),
    [connectWithClient]
  )

  const connectMock = useCallback(
    () => connectWithClient(() => new MockClient()),
    [connectWithClient]
  )

  const disconnect = useCallback(async () => {
    if (client) await client.disconnect()
    setClient(null)
    setStatus('idle')
    pushLog({ direction: 'info', message: 'Disconnected', ts: Date.now() })
  }, [client, pushLog])

  const sendBytes = useCallback(
    async (data: Uint8Array, label?: string) => {
      if (!client) throw new Error('No device connected')
      try {
        await client.send(data)
        pushLog({
          direction: 'tx',
          message: label ?? describePayload(data),
          ts: Date.now()
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        setLastError(message)
        setStatus('error')
        pushLog({ direction: 'error', message, ts: Date.now() })
        throw error
      }
    },
    [client, pushLog]
  )

  const sendJson = useCallback(
    async (payload: Record<string, unknown>) => {
      const bytes = encoder.encode(JSON.stringify(payload))
      await sendBytes(
        bytes,
        `${payload.op ?? 'json'} (${bytes.length} bytes)`
      )
    },
    [sendBytes]
  )

  const transport = useMemo(
    () => client?.transport ?? lastTransport.current,
    [client?.transport]
  )

  useEffect(() => {
    if (!client) return
    const interval = setInterval(() => {
      if (!client.isConnected()) {
        setClient(null)
        setStatus('idle')
        setDeviceName('')
        pushLog({
          direction: 'info',
          message: 'Device connection lost',
          ts: Date.now()
        })
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [client, pushLog])

  return {
    status,
    deviceName,
    transport,
    logs,
    lastError,
    connectHid,
    connectBle,
    connectMock,
    disconnect,
    sendBytes,
    sendJson
  }
}

export default useDeviceLink
