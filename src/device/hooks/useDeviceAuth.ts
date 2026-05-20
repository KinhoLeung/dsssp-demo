import { useCallback, useMemo, useState } from 'react'

import type { WebhmiClient } from '@/device'
import { base64ToBytes } from '@/device/utils/dbHelpers'

export function useDeviceAuth() {
  const [authOk, setAuthOk] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState<string>('')

  const publicKeySpkiDer = useMemo(() => {
    const b64 = (import.meta.env.VITE_AUTH_PUBLIC_KEY_B64 as string | undefined) ?? ''
    if (!b64) return null
    try {
      return base64ToBytes(b64)
    } catch {
      return null
    }
  }, [])

  const resetAuth = useCallback(() => {
    setAuthOk(null)
    setAuthError('')
  }, [])

  const doAuth = useCallback(
    async (targetClient: WebhmiClient): Promise<boolean> => {
      setAuthOk(null)
      setAuthError('')

      if (!publicKeySpkiDer) {
        const err = 'Missing/invalid VITE_AUTH_PUBLIC_KEY_B64 in .env'
        setAuthOk(false)
        setAuthError(err)
        return false
      }

      try {
        console.info('[useDeviceAuth] Starting authVerify...')
        const ok = await targetClient.authVerify(publicKeySpkiDer)
        setAuthOk(ok)
        setAuthError(ok ? '' : 'Signature verification failed')
        console.info('[useDeviceAuth] authVerify result:', ok)
        return ok
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e)
        setAuthOk(false)
        setAuthError(errMsg)
        return false
      }
    },
    [publicKeySpkiDer],
  )

  return {
    authOk,
    authError,
    doAuth,
    resetAuth,
  }
}
