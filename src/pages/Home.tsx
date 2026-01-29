import { Bluetooth, MonitorPlay, Usb } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import CodeHoverCards from '@/components/lightswind/code-hover-cards'
import type { CardData } from '@/components/lightswind/code-hover-cards'
import { Spinner } from '@/components/ui/spinner'
import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { setSelectedBleDevice, setSelectedHidDevice } from '@/device/selectedDevices'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'
import { toast } from '@/hooks/use-toast'

const cards = [
  {
    id: 'usb',
    icon: Usb,
    title: 'USB',
  },
  {
    id: 'ble',
    icon: Bluetooth,
    title: 'BLE',
  },
  {
    id: 'demo-mode',
    icon: MonitorPlay,
    title: 'Demo Mode',
  }
]

function Home() {
  const navigate = useNavigate()
  const { state, actions } = useDeviceSessionContext()
  const [connectingMessage, setConnectingMessage] = useState('')

  const handleCardClick = async (card: CardData) => {
    if (card.id === 'usb') {
      if (!navigator.hid) {
        window.alert('WebHID is not supported by this browser.')
        return
      }
      const hidFilters = HID_DEVICE_PROFILES.map((profile) => ({
        vendorId: profile.vendorId,
        productId: profile.productId,
        usagePage: profile.usagePage,
        usage: profile.usage,
      }))
      if (hidFilters.length === 0) {
        window.alert('No HID device profiles configured.')
        return
      }
      try {
        const [device] = await navigator.hid.requestDevice({ filters: hidFilters })
        if (!device) return
        setSelectedHidDevice(device)
        setConnectingMessage(`Connecting to ${device.productName || 'USB Device'}...`)
        const ok = await actions.connectHid({ interactive: false })
        if (ok) {
          navigate('/device-demo?transport=hid')
        } else {
          toast.destructive({
            title: 'Connection Failed',
            description: state.error || state.authError || 'Failed to connect to USB device.'
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'NotFoundError' && (e as Error).name !== 'AbortError') {
          toast.destructive({
            title: 'Connection Error',
            description: (e as Error).message
          })
        }
      } finally {
        setConnectingMessage('')
      }
      return
    }
    if (card.id === 'ble') {
      if (!navigator.bluetooth) {
        window.alert('WebBLE is not supported by this browser.')
        return
      }
      const bleFilters = BLE_DEVICE_PROFILES.map((profile) => ({
        services: [profile.service],
      }))
      if (bleFilters.length === 0) {
        window.alert('No BLE device profiles configured.')
        return
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: bleFilters,
          optionalServices: uniqueBleServices(),
        })
        setSelectedBleDevice(device)
        setConnectingMessage(`Connecting to ${device.name || 'Bluetooth Device'}...`)
        const ok = await actions.connectBle({ interactive: false })
        if (ok) {
          navigate('/device-demo?transport=ble')
        } else {
          toast.destructive({
            title: 'Connection Failed',
            description: state.error || state.authError || 'Failed to connect to Bluetooth device.'
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'NotFoundError' && (e as Error).name !== 'AbortError') {
          toast.destructive({
            title: 'Connection Error',
            description: (e as Error).message
          })
        }
      } finally {
        setConnectingMessage('')
      }
      return
    }
    if (card.id === 'demo-mode') {
      navigate('/demo-mode')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 py-8 min-h-[calc(100vh-8rem)] relative">
      <div className="flex flex-1 items-center justify-center">
        <CodeHoverCards
          cards={cards}
          className="justify-center"
          cardClassName="max-w-[180px] mx-auto"
          cardGap="4rem"
          minHeight={100}
          iconSize={42}
          showCode={false}
          onCardClick={handleCardClick}
        />
      </div>

      {connectingMessage && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg">
            <Spinner className="size-12 text-primary" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-medium animate-pulse">{connectingMessage}</p>
              <p className="text-sm text-muted-foreground">This may take a few seconds, please do not close the page.</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Home
