import { createContext, useContext } from 'react'

import { useDeviceSession } from '../hooks/useDeviceSession'

type DeviceSessionValue = ReturnType<typeof useDeviceSession>

const DeviceSessionContext = createContext<DeviceSessionValue | null>(null)

export function DeviceSessionProvider({ children }: { children: React.ReactNode }) {
  const value = useDeviceSession()
  return <DeviceSessionContext.Provider value={value}>{children}</DeviceSessionContext.Provider>
}

export function useDeviceSessionContext() {
  const ctx = useContext(DeviceSessionContext)
  if (!ctx) throw new Error('useDeviceSessionContext must be used within DeviceSessionProvider')
  return ctx
}

