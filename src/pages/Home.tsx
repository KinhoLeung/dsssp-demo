import { Bluetooth, MonitorPlay, Usb } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import CodeHoverCards from '@/components/lightswind/code-hover-cards'
import type { CardData } from '@/components/lightswind/code-hover-cards'
import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { setSelectedBleDevice, setSelectedHidDevice } from '@/device/selectedDevices'

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

  const handleCardClick = async (card: CardData) => {
    if (card.id === 'usb') {
      if (!navigator.hid) {
        window.alert('当前浏览器不支持 WebHID。')
        return
      }
      const hidFilters = HID_DEVICE_PROFILES.map((profile) => ({
        vendorId: profile.vendorId,
        productId: profile.productId,
      }))
      if (hidFilters.length === 0) {
        window.alert('未配置可用的 HID 设备。')
        return
      }
      try {
        const [device] = await navigator.hid.requestDevice({ filters: hidFilters })
        if (!device) return
        setSelectedHidDevice(device)
        navigate('/device?transport=hid')
      } catch {
        // ignored (user cancelled)
      }
      return
    }
    if (card.id === 'ble') {
      if (!navigator.bluetooth) {
        window.alert('当前浏览器不支持 WebBLE。')
        return
      }
      const bleFilters = BLE_DEVICE_PROFILES.map((profile) => ({
        services: [profile.service],
      }))
      if (bleFilters.length === 0) {
        window.alert('未配置可用的 BLE 设备。')
        return
      }
      try {
        const device = await navigator.bluetooth.requestDevice({
          filters: bleFilters,
          optionalServices: uniqueBleServices(),
        })
        setSelectedBleDevice(device)
        navigate('/device?transport=ble')
      } catch {
        // ignored (user cancelled)
      }
      return
    }
    if (card.id === 'demo-mode') {
      navigate('/demo-mode')
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 py-8 min-h-[calc(100vh-8rem)]">
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
    </section>
  )
}

export default Home
