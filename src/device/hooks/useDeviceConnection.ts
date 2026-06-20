import { useCallback, useEffect, useRef, useState } from 'react'

import {
  BLE_DEVICE_PROFILES,
  findBleDeviceProfile,
  findHidDeviceProfile,
  getBleRequestFilters,
  getHidRequestFilters,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { BleTransport, HidTransport, WebhmiClient } from '@/device'
import {
  getSelectedBleDevice,
  getSelectedHidDevice,
  setSelectedBleDevice,
  setSelectedHidDevice,
} from '@/device/selectedDevices'
import i18n from '@/locales/i18n'

export function useDeviceConnection(options: {
  onTransportDisconnected?: () => void
} = {}) {
  const [connected, setConnected] = useState(false)
  const [transportKind, setTransportKind] = useState<'hid' | 'ble' | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clientRef = useRef<WebhmiClient | null>(null)
  const disconnectCleanupRef = useRef<(() => void) | null>(null)

  const disconnect = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      disconnectCleanupRef.current?.()
      disconnectCleanupRef.current = null

      if (clientRef.current) {
        await clientRef.current.disconnect()
        clientRef.current = null
      }

      setConnected(false)
      setTransportKind(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const handleTransportDisconnected = useCallback(async () => {
    await disconnect()
    options.onTransportDisconnected?.()
  }, [disconnect, options.onTransportDisconnected])

  const connectHid = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<WebhmiClient | null> => {
      if (!navigator.hid) {
        window.alert(i18n.t('errors.webhidNotSupported'))
        return null
      }
      if (clientRef.current) await disconnect()
      const interactive = options.interactive !== false

      setBusy(true)
      setError('')
      try {
        const existing = getSelectedHidDevice()
        const device =
          existing ??
          (interactive
            ? (
              await navigator.hid.requestDevice({
                filters: getHidRequestFilters(),
              })
            )[0]
            : null)

        if (!device) return null
        setSelectedHidDevice(device)

        const profile = findHidDeviceProfile(device)
        if (!profile) throw new Error('No HID device profile configured')

        const transport = new HidTransport(device, { reportId: profile.reportId, reportSize: profile.reportSize })
        const nextClient = new WebhmiClient(transport)
        await nextClient.connect()

        const onDisconnect = (event: HIDConnectionEvent) => {
          if (event.device !== device) return
          console.warn('[HID] disconnected')
          void handleTransportDisconnected()
        }
        navigator.hid?.addEventListener('disconnect', onDisconnect)

        clientRef.current = nextClient
        disconnectCleanupRef.current = () => {
          navigator.hid?.removeEventListener('disconnect', onDisconnect)
        }

        setConnected(true)
        setTransportKind('hid')
        return nextClient
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return null
      } finally {
        setBusy(false)
      }
    },
    [disconnect, handleTransportDisconnected],
  )

  const connectBle = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<WebhmiClient | null> => {
      if (!navigator.bluetooth) {
        window.alert(i18n.t('errors.webbleNotSupported'))
        return null
      }
      if (clientRef.current) await disconnect()
      const interactive = options.interactive !== false
      if (BLE_DEVICE_PROFILES.length === 0) {
        window.alert(i18n.t('errors.noBleProfiles'))
        return null
      }

      setBusy(true)
      setError('')
      try {
        const existing = getSelectedBleDevice()
        const device =
          existing ??
          (interactive
            ? await navigator.bluetooth.requestDevice({
              filters: getBleRequestFilters(),
              optionalServices: uniqueBleServices(),
            })
            : null)

        if (!device) return null
        setSelectedBleDevice(device)

        const profile = findBleDeviceProfile(device)

        const transport = new BleTransport(device, {
          service: profile.service,
          characteristic: profile.characteristic,
          notify: profile.notify,
        })
        const nextClient = new WebhmiClient(transport)
        await nextClient.connect()

        const onDisconnect = () => {
          console.warn('[BLE] disconnected')
          void handleTransportDisconnected()
        }
        device.addEventListener('gattserverdisconnected', onDisconnect)

        const gattPollId = window.setInterval(() => {
          const connected = device.gatt?.connected
          if (connected === true) return
          window.clearInterval(gattPollId)
          console.warn('[BLE] gatt.connected=false')
          void handleTransportDisconnected()
        }, 200)

        clientRef.current = nextClient
        disconnectCleanupRef.current = () => {
          device.removeEventListener('gattserverdisconnected', onDisconnect)
          window.clearInterval(gattPollId)
        }

        setConnected(true)
        setTransportKind('ble')
        return nextClient
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        return null
      } finally {
        setBusy(false)
      }
    },
    [disconnect, handleTransportDisconnected],
  )

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  return {
    connected,
    transportKind,
    client: clientRef.current,
    busy,
    error,
    connectHid,
    connectBle,
    disconnect,
    setCleanup: (cleanup: () => void) => {
      const prev = disconnectCleanupRef.current
      disconnectCleanupRef.current = () => {
        prev?.()
        cleanup()
      }
    }
  }
}
