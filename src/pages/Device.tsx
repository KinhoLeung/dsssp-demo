import { useEffect, useMemo, useState } from 'react'
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

  const hidProfile = useMemo(() => HID_DEVICE_PROFILES[0], [])
  const bleProfile = useMemo(() => BLE_DEVICE_PROFILES[0], [])

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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const getDb = async () => {
    if (!client) return
    setBusy(true)
    setError('')
    try {
      const db = await client.getDb()
      setDbJson(JSON.stringify(db, null, 2))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
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
