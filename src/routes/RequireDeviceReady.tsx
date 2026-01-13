import { useEffect, useMemo, useRef } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'

import { getSelectedBleDevice, getSelectedHidDevice } from '@/device/selectedDevices'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'

export function RequireDeviceReady({ children }: { children: React.ReactNode }) {
  const { state, actions } = useDeviceSessionContext()
  const [searchParams] = useSearchParams()
  const transport = searchParams.get('transport')

  const preferred = useMemo(() => {
    if (transport === 'hid' || transport === 'ble') return transport
    return null
  }, [transport])

  const didKickoff = useRef(false)
  useEffect(() => {
    if (state.authOk === true && state.db) return
    if (didKickoff.current) return
    didKickoff.current = true

    const hasHid = !!getSelectedHidDevice()
    const hasBle = !!getSelectedBleDevice()

    if (preferred === 'hid' && hasHid) {
      void actions.connectHid({ interactive: false })
      return
    }
    if (preferred === 'ble' && hasBle) {
      void actions.connectBle({ interactive: false })
      return
    }
    if (!preferred && hasHid) {
      void actions.connectHid({ interactive: false })
      return
    }
    if (!preferred && hasBle) {
      void actions.connectBle({ interactive: false })
      return
    }
  }, [actions, preferred, state.authOk, state.db])

  if (state.authOk === true && state.db) return <>{children}</>

  const canRetry =
    (preferred === 'hid' && !!getSelectedHidDevice()) ||
    (preferred === 'ble' && !!getSelectedBleDevice()) ||
    (!preferred && (!!getSelectedHidDevice() || !!getSelectedBleDevice()))

  if (!canRetry) return <Navigate to="/" replace />
  if (!state.busy && (state.authOk === false || !!state.error)) return <Navigate to="/" replace />
  return null
}
