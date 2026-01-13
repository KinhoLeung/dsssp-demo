import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useDeviceSession } from '@/device/hooks/useDeviceSession'

function Device() {
  const [searchParams] = useSearchParams()
  const preferredTransport = searchParams.get('transport')
  const normalizedPreferred = useMemo(() => {
    if (preferredTransport === 'hid' || preferredTransport === 'ble') return preferredTransport
    return null
  }, [preferredTransport])

  const { state, actions } = useDeviceSession({ preferredTransport: normalizedPreferred })

  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 py-8">
      <Card>
        <CardContent className="p-4 flex flex-col gap-3">
          <div className="flex flex-wrap gap-2 items-center">
            <Button disabled={state.busy || state.transport === 'hid'} onClick={() => void actions.connectHid()}>
              Connect HID
            </Button>
            <Button disabled={state.busy || state.transport === 'ble'} onClick={() => void actions.connectBle()}>
              Connect BLE
            </Button>
            <Button disabled={state.busy || !state.connected} variant="secondary" onClick={() => void actions.refreshDb()}>
              Get DB
            </Button>
            <Button disabled={state.busy || !state.connected} variant="destructive" onClick={() => void actions.disconnect()}>
              Disconnect
            </Button>
          </div>

          <div className="text-sm text-muted-foreground">
            Status: {state.connected ? `connected (${state.transport})` : 'disconnected'}
          </div>

          {state.connected ? (
            <div className="text-sm text-muted-foreground">
              Auth: {state.authOk === null ? 'pending/unknown' : state.authOk ? 'ok' : 'failed'}
              {state.authError ? ` (${state.authError})` : ''}
            </div>
          ) : null}

          {state.dirty ? (
            <div className="text-sm text-muted-foreground">
              Pending changes: {state.flushing ? 'flushing…' : 'yes'}
              {state.flushError ? ` (last error: ${state.flushError})` : ''}
            </div>
          ) : null}

          {state.error ? <pre className="text-xs text-red-500 whitespace-pre-wrap">{state.error}</pre> : null}
        </CardContent>
      </Card>

      {state.dbJson ? (
        <Card>
          <CardContent className="p-4">
            <pre className="text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">{state.dbJson}</pre>
          </CardContent>
        </Card>
      ) : null}
    </section>
  )
}

export default Device
