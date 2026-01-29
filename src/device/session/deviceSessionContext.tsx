import { createContext, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

import { toast } from '@/hooks/use-toast'

import { useDeviceSession } from '../hooks/useDeviceSession'

type DeviceSessionValue = ReturnType<typeof useDeviceSession>

const DeviceSessionContext = createContext<DeviceSessionValue | null>(null)

export function DeviceSessionProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate()
  const onTransportDisconnected = useCallback(() => {
    toast.destructive({
      title: 'Device Disconnected',
      description: 'The connection to the device has been lost. Please check the connection and try again.',
    })
    navigate('/', { replace: true })
  }, [navigate])

  const value = useDeviceSession({ onTransportDisconnected })
  return <DeviceSessionContext.Provider value={value}>{children}</DeviceSessionContext.Provider>
}

export function useDeviceSessionContext() {
  const ctx = useContext(DeviceSessionContext)
  if (!ctx) throw new Error('useDeviceSessionContext must be used within DeviceSessionProvider')
  return ctx
}
