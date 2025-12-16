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
import { FramedClient } from '../protocol/framedClient'
import { encodeJson } from '../protocol/jsonCodec'
import { MsgId } from '../protocol/msgIds'
import { RpcClient } from '../protocol/rpcClient'
import {
  AUTH_NONCE_LEN,
  verifyAuthResponse
} from '../utils/deviceAuth'

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
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [firmwareVersion, setFirmwareVersion] = useState<string | null>(
    null
  )
  const [authInProgress, setAuthInProgress] = useState(false)
  const lastTransport = useRef<TransportType | null>(null)
  const hasTriedAuthRef = useRef(false)
  const pendingAuthRef = useRef<{
    nonce: Uint8Array
    resolve: (result: boolean) => void
    reject: (error: Error) => void
  } | null>(null)
  const authTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const framedRef = useRef<FramedClient | null>(null)
  const rpcRef = useRef<RpcClient | null>(null)

  const pushLog = useCallback((entry: DeviceLogEntry) => {
    setLogs((prev) => [...prev.slice(-40), entry])
  }, [])

  const attachProtocol = useCallback(
    (nextClient: DeviceClient) => {
      const framed = new FramedClient(nextClient)
      const rpc = new RpcClient(framed)

      framed.onFrame((frame) => {
        pushLog({
          direction: 'rx',
          message: `msg 0x${frame.msgId
            .toString(16)
            .padStart(4, '0')} flags 0x${frame.flags
            .toString(16)
            .padStart(2, '0')} ${describePayload(frame.payload)}`,
          ts: Date.now()
        })

        const pending = pendingAuthRef.current
        if (
          pending &&
          frame.msgId === MsgId.Auth &&
          frame.payload.length > 0
        ) {
          pendingAuthRef.current = null
          if (authTimeoutRef.current) {
            clearTimeout(authTimeoutRef.current)
            authTimeoutRef.current = null
          }

          ;(async () => {
            setAuthInProgress(false)
            const result = await verifyAuthResponse(
              pending.nonce,
              frame.payload
            )
            if (result.ok) {
              setIsAuthorized(true)
              setDeviceId(result.deviceId ?? null)
              setFirmwareVersion(result.firmwareVersion ?? null)
              pushLog({
                direction: 'info',
                message: `Auth OK${
                  result.deviceId ? ` (ID ${result.deviceId})` : ''
                }${
                  result.firmwareVersion
                    ? ` (FW ${result.firmwareVersion})`
                    : ''
                }`,
                ts: Date.now()
              })
              pending.resolve(true)
            } else {
              const message =
                result.error ?? 'Device authorization failed'
              setIsAuthorized(false)
              setLastError(message)
              pushLog({
                direction: 'error',
                message,
                ts: Date.now()
              })
              pending.reject(new Error(message))
            }
          })().catch((error: unknown) => {
            const message =
              error instanceof Error
                ? error.message
                : String(error)
            setIsAuthorized(false)
            setLastError(message)
            pushLog({
              direction: 'error',
              message,
              ts: Date.now()
            })
          })
        }
      })

      framed.attach()
      framedRef.current = framed
      rpcRef.current = rpc
    },
    [pushLog]
  )

  const attachDisconnect = useCallback(
    (nextClient: DeviceClient) => {
      nextClient.onDisconnect(() => {
        setClient(null)
        setStatus('idle')
        setDeviceName('')
        setIsAuthorized(false)
        setDeviceId(null)
        setFirmwareVersion(null)
        hasTriedAuthRef.current = false
	      if (authTimeoutRef.current) {
	        clearTimeout(authTimeoutRef.current)
	        authTimeoutRef.current = null
	      }
	      pendingAuthRef.current = null
	      framedRef.current?.reset()
	      rpcRef.current?.resetPending('reconnect')
	      framedRef.current = null
	      rpcRef.current = null
		      framedRef.current?.reset()
		      rpcRef.current?.resetPending('disconnect')
		      framedRef.current = null
		      rpcRef.current = null
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
      setIsAuthorized(false)
      setDeviceId(null)
      setFirmwareVersion(null)
      hasTriedAuthRef.current = false
      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current)
        authTimeoutRef.current = null
      }
      pendingAuthRef.current = null

      try {
	        const nextClient = factory()
	        await nextClient.connect()
	        attachProtocol(nextClient)
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
	    [attachProtocol, attachDisconnect, client, pushLog]
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
    setIsAuthorized(false)

    hasTriedAuthRef.current = false
	    if (authTimeoutRef.current) {
	      clearTimeout(authTimeoutRef.current)
	      authTimeoutRef.current = null
		    }
		    pendingAuthRef.current = null
		    framedRef.current?.reset()
		    rpcRef.current?.resetPending('disconnect')
		    framedRef.current = null
		    rpcRef.current = null
		    pushLog({ direction: 'info', message: 'Disconnected', ts: Date.now() })
	  }, [client, pushLog])

  const sendBytes = useCallback(
    async (data: Uint8Array, label?: string) => {
      if (!client || !framedRef.current)
        throw new Error('No device connected')
      try {
        await framedRef.current.sendFrame({
          msgId: MsgId.Auth,
          payload: data
        })
        pushLog({
          direction: 'tx',
          message: label ?? describePayload(data),
          ts: Date.now()
        })
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        setLastError(message)
        setStatus('error')
        pushLog({ direction: 'error', message, ts: Date.now() })
        throw error
      }
    },
    [client, pushLog]
  )

  const callJson = useCallback(
    async (msgId: number, payload: Record<string, unknown>) => {
      if (!rpcRef.current) throw new Error('RPC not ready')
      const bytes = encodeJson(payload)
      pushLog({
        direction: 'tx',
        message: `msg 0x${msgId
          .toString(16)
          .padStart(4, '0')} ${payload.op ?? 'json'} (${bytes.length} bytes)`,
        ts: Date.now()
      })
      try {
        return await rpcRef.current.call(msgId, bytes)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        setLastError(message)
        setStatus('error')
        pushLog({ direction: 'error', message, ts: Date.now() })
        throw error
      }
    },
    [pushLog]
  )

  const sendJson = useCallback(
    async (msgId: number, payload: Record<string, unknown>) => {
      if (!rpcRef.current) throw new Error('RPC not ready')
      const bytes = encodeJson(payload)
      pushLog({
        direction: 'tx',
        message: `msg 0x${msgId
          .toString(16)
          .padStart(4, '0')} ${payload.op ?? 'json'} (${bytes.length} bytes)`,
        ts: Date.now()
      })
      try {
        await rpcRef.current.notify(msgId, bytes)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : String(error)
        setLastError(message)
        setStatus('error')
        pushLog({ direction: 'error', message, ts: Date.now() })
        throw error
      }
    },
    [pushLog]
  )

  const authenticate = useCallback(async () => {
    if (!client) throw new Error('No device connected')

    if (
      typeof window === 'undefined' ||
      !window.crypto ||
      !window.crypto.subtle
    ) {
      const message =
        'WebCrypto ECDSA is not available in this environment'
      setLastError(message)
      pushLog({ direction: 'error', message, ts: Date.now() })
      return false
    }

    setIsAuthorized(false)

    setAuthInProgress(true)

	    const nonce = new Uint8Array(AUTH_NONCE_LEN)
	    window.crypto.getRandomValues(nonce)
	    const payload = nonce

    return await new Promise<boolean>((resolve, reject) => {
      pendingAuthRef.current = { nonce, resolve, reject }

	      sendBytes(payload, 'auth_challenge').catch((error) => {
        pendingAuthRef.current = null
        setAuthInProgress(false)
        const message =
          error instanceof Error ? error.message : String(error)
        setLastError(message)
        pushLog({
          direction: 'error',
          message,
          ts: Date.now()
        })
        reject(error)
      })

      if (authTimeoutRef.current) {
        clearTimeout(authTimeoutRef.current)
      }
      authTimeoutRef.current = setTimeout(() => {
        if (pendingAuthRef.current) {
          pendingAuthRef.current = null
          setAuthInProgress(false)
          const message = 'Auth response timeout'
          setLastError(message)
          pushLog({
            direction: 'error',
            message,
            ts: Date.now()
          })
          reject(new Error(message))
        }
      }, 5000)
    })
  }, [client, pushLog, sendBytes])

  const transport = useMemo(
    () => client?.transport ?? lastTransport.current,
    [client?.transport]
  )

  useEffect(() => {
    if (!client) return
    if (status !== 'connected') return
    if (hasTriedAuthRef.current) return

    hasTriedAuthRef.current = true
    void authenticate().catch(() => {
      // errors are already logged inside authenticate
    })
  }, [authenticate, client, status])

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
    }, 200)
    return () => clearInterval(interval)
  }, [client, pushLog])

  const getCapabilities = useCallback(
    async () =>
      await callJson(MsgId.getCapabilities, {
        op: 'get_capabilities',
        ts: Date.now()
      }),
    [callJson]
  )



  return {
    status,
    deviceName,
    transport,
    logs,
    lastError,
    isAuthorized,
    deviceId,
    firmwareVersion,
    authInProgress,
    connectHid,
    connectBle,
    connectMock,
    disconnect,
    sendBytes,
    sendJson,
    authenticate,
    getCapabilities,

  }
}

export default useDeviceLink
