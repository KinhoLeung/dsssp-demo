import { Bluetooth, MonitorPlay, Usb } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import CodeHoverCards from '@/components/lightswind/code-hover-cards'
import type { CardData } from '@/components/lightswind/code-hover-cards'
import ColourfulText from '@/components/ui/colourful-text'
import { Spinner } from '@/components/ui/spinner'
import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { setSelectedBleDevice, setSelectedHidDevice } from '@/device/selectedDevices'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'
import { toast } from '@/hooks/use-toast'

function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { state, actions } = useDeviceSessionContext()
  const [connectingDevice, setConnectingDevice] = useState<string | null>(null)

  const cards: CardData[] = [
    { id: 'usb', icon: Usb, title: t('home.card.usb') },
    { id: 'ble', icon: Bluetooth, title: t('home.card.ble') },
    { id: 'demo-mode', icon: MonitorPlay, title: t('home.card.demoMode') },
  ]

  const handleCardClick = async (card: CardData) => {
    if (card.id === 'usb') {
      if (!navigator.hid) {
        window.alert(t('errors.webhidNotSupported'))
        return
      }
      const hidFilters = HID_DEVICE_PROFILES.map((profile) => ({
        vendorId: profile.vendorId,
        productId: profile.productId,
        usagePage: profile.usagePage,
        usage: profile.usage,
      }))
      if (hidFilters.length === 0) {
        window.alert(t('errors.noHidProfiles'))
        return
      }
      try {
        const [device] = await navigator.hid.requestDevice({ filters: hidFilters })
        if (!device) return
        setSelectedHidDevice(device)
        setConnectingDevice(device.productName || t('devices.usbDevice'))
        const ok = await actions.connectHid({ interactive: false })
        if (ok) {
          navigate('/device-demo?transport=hid')
        } else {
          toast.destructive({
            title: t('toast.connectionFailed.title'),
            description: state.error || state.authError || t('toast.connectionFailed.usb')
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'NotFoundError' && (e as Error).name !== 'AbortError') {
          toast.destructive({
            title: t('toast.connectionError.title'),
            description: (e as Error).message
          })
        }
      } finally {
        setConnectingDevice(null)
      }
      return
    }
    if (card.id === 'ble') {
      if (!navigator.bluetooth) {
        window.alert(t('errors.webbleNotSupported'))
        return
      }
      const bleFilters = BLE_DEVICE_PROFILES.map((profile) => ({
        services: [profile.service],
      }))
      if (bleFilters.length === 0) {
        window.alert(t('errors.noBleProfiles'))
        return
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: bleFilters,
          optionalServices: uniqueBleServices(),
        })
        setSelectedBleDevice(device)
        setConnectingDevice(device.name || t('devices.bluetoothDevice'))
        const ok = await actions.connectBle({ interactive: false })
        if (ok) {
          navigate('/device-demo?transport=ble')
        } else {
          toast.destructive({
            title: t('toast.connectionFailed.title'),
            description: state.error || state.authError || t('toast.connectionFailed.ble')
          })
        }
      } catch (e) {
        if ((e as Error).name !== 'NotFoundError' && (e as Error).name !== 'AbortError') {
          toast.destructive({
            title: t('toast.connectionError.title'),
            description: (e as Error).message
          })
        }
      } finally {
        setConnectingDevice(null)
      }
      return
    }
    if (card.id === 'demo-mode') {
      navigate('/demo-mode')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col min-h-[calc(100vh-8rem)] relative">
      <div className="flex-1 flex flex-col items-center justify-center w-full p-6">
        <div className="flex flex-col items-center text-center space-y-10">
          <h1 className="text-7xl sm:text-8xl font-extrabold tracking-tight drop-shadow-sm">
            <span className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t('home.welcomePrefix')}
            </span>
            <span className="inline-block"><ColourfulText text="WebHMI" /></span>
          </h1>
          <p className="max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed">
            <Trans
              i18nKey="home.intro"
              components={{
                usb: <span className="font-medium text-foreground" />,
                ble: <span className="font-medium text-foreground" />,
              }}
            />
          </p>
        </div>
      </div>

      {/* Cards Section: Fixed center anchor */}
      <div className="flex-none flex items-center justify-center w-full py-8">
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

      {/* Footer Section: Occupies bottom space and centers content */}
      <div className="flex-1 flex flex-col items-center justify-center w-full p-6">
        <p className="max-w-4xl text-center text-lg sm:text-xl text-muted-foreground leading-relaxed">
          <Trans
            i18nKey="home.footer"
            components={{
              chrome: <span className="font-medium text-foreground" />,
              edge: <span className="font-medium text-foreground" />,
            }}
          />
        </p>
      </div>

      {connectingDevice && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300 animate-in fade-in">
          <div className="flex flex-col items-center gap-4 p-8 rounded-xl bg-card border shadow-lg">
            <Spinner className="size-12 text-primary" />
            <div className="flex flex-col items-center gap-1">
              <p className="text-lg font-medium animate-pulse">
                {t('home.connectingTo', { device: connectingDevice })}
              </p>
              <p className="text-sm text-muted-foreground">{t('home.connectingNotice')}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Home
