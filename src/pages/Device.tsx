import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { BleTransport, HidTransport, WebhmiClient } from '@/device'
import {
  getSelectedBleDevice,
  getSelectedHidDevice,
  setSelectedBleDevice,
  setSelectedHidDevice,
} from '@/device/selectedDevices'

function Device() {
  const [searchParams] = useSearchParams()
  const preferredTransport = searchParams.get('transport')

  const [client, setClient] = useState<WebhmiClient | null>(null)
  const [connectedTransport, setConnectedTransport] = useState<'hid' | 'ble' | null>(null)
  const [dbJson, setDbJson] = useState<string>('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string>('')
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<string>('')

  const hidProfile = useMemo(() => HID_DEVICE_PROFILES[0], [])
  const bleProfile = useMemo(() => BLE_DEVICE_PROFILES[0], [])
  const didAutoConnect = useRef(false)
  const publicKeySpkiDer = useMemo(() => {
    const b64 = (import.meta.env.VITE_AUTH_PUBLIC_KEY_B64 as string | undefined) ?? ''
    if (!b64) return null
    try {
      return base64ToBytes(b64)
    } catch {
      return null
    }
  }, [])

  useEffect(() => {
    return () => {
      void client?.disconnect()
    }
  }, [client])

  const disconnect = async () => {
    setBusy(true)
    setError('')
    try {
      await client?.disconnect()
      setClient(null)
      setConnectedTransport(null)
      setDbJson('')
      setAuthOk(null)
      setAuthError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const doAuth = async (targetClient: WebhmiClient) => {
    setAuthOk(null)
    setAuthError('')

    if (!publicKeySpkiDer) {
      setAuthOk(false)
      setAuthError('Missing/invalid VITE_AUTH_PUBLIC_KEY_B64 in .env')
      return false
    }

    try {
      const ok = await targetClient.authVerify(publicKeySpkiDer)
      setAuthOk(ok)
      if (!ok) setAuthError('Signature verification failed')
      return ok
    } catch (e) {
      setAuthOk(false)
      setAuthError(e instanceof Error ? e.message : String(e))
      return false
    }
  }

  const doGetDb = async (targetClient: WebhmiClient) => {
    setError('')
    try {
      const db = await targetClient.getDb()
      const pretty = JSON.stringify(db, null, 2)
      console.info('[GetDbResponse]', pretty)
      setDbJson(pretty)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      setError(message)
      console.error('[GetDbResponse] failed', message)
    }
  }

  const connectHid = async () => {
    if (!navigator.hid) {
      window.alert('当前浏览器不支持 WebHID。')
      return
    }
    if (!hidProfile) {
      window.alert('未配置可用的 HID 设备。')
      return
    }

    setBusy(true)
    setError('')
    try {
      const existing = getSelectedHidDevice()
      const device =
        existing ??
        (await navigator.hid.requestDevice({
          filters: HID_DEVICE_PROFILES.map((p) => ({
            vendorId: p.vendorId,
            productId: p.productId,
          })),
        }))[0]

      if (!device) throw new Error('No HID device selected')
      setSelectedHidDevice(device)

      const profile =
        HID_DEVICE_PROFILES.find((p) => p.vendorId === device.vendorId && p.productId === device.productId) ??
        hidProfile

      const transport = new HidTransport(device, { reportId: profile.reportId, reportSize: profile.reportSize })
      const nextClient = new WebhmiClient(transport)
      await nextClient.connect()

      setClient(nextClient)
      setConnectedTransport('hid')
      setDbJson('')
      const ok = await doAuth(nextClient)
      if (ok) await doGetDb(nextClient)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const connectBle = async () => {
    if (!navigator.bluetooth) {
      window.alert('当前浏览器不支持 WebBLE。')
      return
    }
    if (!bleProfile) {
      window.alert('未配置可用的 BLE 设备。')
      return
    }

    setBusy(true)
    setError('')
    try {
      const existing = getSelectedBleDevice()
      const device =
        existing ??
        (await navigator.bluetooth.requestDevice({
          filters: BLE_DEVICE_PROFILES.map((p) => ({ services: [p.service] })),
          optionalServices: uniqueBleServices(),
        }))

      if (!device) throw new Error('No BLE device selected')
      setSelectedBleDevice(device)

      const transport = new BleTransport(device, {
        service: bleProfile.service,
        characteristic: bleProfile.characteristic,
        notify: bleProfile.notify,
      })
      const nextClient = new WebhmiClient(transport)
      await nextClient.connect()

      setClient(nextClient)
      setConnectedTransport('ble')
      setDbJson('')
      const ok = await doAuth(nextClient)
      if (ok) await doGetDb(nextClient)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const getDb = async () => {
    if (!client) return
    setBusy(true)
    await doGetDb(client)
    setBusy(false)
  }

  useEffect(() => {
    if (didAutoConnect.current) return
    didAutoConnect.current = true
    if (preferredTransport === 'hid') void connectHid()
    if (preferredTransport === 'ble') void connectBle()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 py-8">
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button disabled={busy || connectedTransport === 'hid'} onClick={connectHid}>
              Connect HID
            </Button>
            <Button disabled={busy || connectedTransport === 'ble'} onClick={connectBle}>
              Connect BLE
            </Button>
            <Button disabled={busy || !client} variant="secondary" onClick={getDb}>
              Get DB
            </Button>
            <Button disabled={busy || !client} variant="destructive" onClick={disconnect}>
              Disconnect
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Status: {client ? `connected (${connectedTransport})` : 'disconnected'}
          </div>

          {client ? (
            <div className="text-sm text-muted-foreground">
              Auth: {authOk === null ? 'pending/unknown' : authOk ? 'ok' : 'failed'}
              {authError ? ` (${authError})` : ''}
            </div>
          ) : null}

          {error ? <pre className="text-xs text-red-500 whitespace-pre-wrap">{error}</pre> : null}
        </CardContent>
      </Card>

      {dbJson ? (
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">{dbJson}</pre>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

export default Device

const base64ToBytes = (b64: string) => {
  let normalized = b64.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  if (pad) normalized += '='.repeat(4 - pad)
  const bin = atob(normalized)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
