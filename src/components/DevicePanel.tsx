import clsx from 'clsx'
import { type BiQuadCoefficients, type GraphFilter } from 'dsssp'

import useDeviceLink from '../hooks/useDeviceLink'

import { buttonClasses } from './Presets'

const statusColorMap: Record<string, string> = {
  idle: 'bg-zinc-700',
  connecting: 'bg-amber-500',
  connected: 'bg-green-500',
  error: 'bg-red-500'
}

const DevicePanel = ({
  filters,
  coefficients,
  sampleRate
}: {
  filters: GraphFilter[]
  coefficients: BiQuadCoefficients[]
  sampleRate: number
}) => {
  const {
    status,
    transport,
    deviceName,
    logs,
    lastError,
    isAuthorized,
    boardId,
    authInProgress,
    connectBle,
    connectHid,
    connectMock,
    disconnect,
    sendJson
  } = useDeviceLink()

  const busy = status === 'connecting'
  const connected = status === 'connected'
  const statusDot = statusColorMap[status] || 'bg-zinc-700'
  const recentLogs = logs.slice(-4).reverse()

  const handlePing = async () => {
    try {
      await sendJson({ op: 'ping', ts: Date.now() })
    } catch (error) {
      console.error(error)
    }
  }

  const handleSendFilters = async () => {
    try {
      await sendJson({
        op: 'filters',
        ts: Date.now(),
        payload: { filters, coefficients, sampleRate }
      })
    } catch (error) {
      console.error(error)
    }
  }

  return (
    <div className="flex flex-col gap-2 bg-black border border-zinc-800 rounded-sm px-3 py-2 shadow-sm">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={clsx('w-2.5 h-2.5 rounded-full', statusDot)} />
          <span className="uppercase text-xs tracking-wide text-zinc-500">
            {status}
          </span>
          <span className="text-sm text-zinc-200">
            {deviceName || 'No device'}
            {transport ? ` · ${transport.toUpperCase()}` : ''}
            {connected && (
              <span className="ml-2 text-xs text-zinc-400">
                {isAuthorized ? 'Authorized' : 'Not authorized'}
                {isAuthorized && boardId ? ` · ID ${boardId}` : ''}
              </span>
            )}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            className={clsx(buttonClasses, 'px-3 text-xs', {
              'opacity-50 pointer-events-none': busy
            })}
            onClick={connectHid}
          >
            USB (HID)
          </button>
          <button
            className={clsx(buttonClasses, 'px-3 text-xs', {
              'opacity-50 pointer-events-none': busy
            })}
            onClick={connectBle}
          >
            Bluetooth (BLE)
          </button>
          <button
            className={clsx(buttonClasses, 'px-3 text-xs', {
              'opacity-50 pointer-events-none': busy
            })}
            onClick={connectMock}
          >
            Mock
          </button>
          <button
            className={clsx(buttonClasses, 'px-3 text-xs', {
              'opacity-50 pointer-events-none': !connected && status !== 'error'
            })}
            onClick={disconnect}
          >
            Disconnect
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          className={clsx(buttonClasses, 'px-3 text-xs', {
            'opacity-50 pointer-events-none':
              !connected || busy || authInProgress || !isAuthorized
          })}
          onClick={handlePing}
        >
          Ping
        </button>
        <button
          className={clsx(buttonClasses, 'px-3 text-xs', {
            'opacity-50 pointer-events-none':
              !connected || busy || authInProgress || !isAuthorized
          })}
          onClick={handleSendFilters}
        >
          Send filters
        </button>
      </div>

      <div className="bg-zinc-950 border border-zinc-900 rounded-sm px-2 py-2 text-xs text-zinc-400">
        <div className="flex items-center justify-between text-[11px] text-zinc-500">
          <span>Traffic</span>
          {lastError && <span className="text-red-400">{lastError}</span>}
        </div>

        <div className="mt-1 space-y-1">
          {recentLogs.length === 0 && (
            <div className="text-zinc-600">Waiting for traffic…</div>
          )}
          {recentLogs.map((log, index) => (
            <div key={index}>
              <span
                className={clsx('inline-block w-7 font-semibold', {
                  'text-green-400': log.direction === 'tx',
                  'text-sky-400': log.direction === 'rx',
                  'text-amber-400': log.direction === 'info',
                  'text-red-400': log.direction === 'error'
                })}
              >
                {log.direction.toUpperCase()}
              </span>
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DevicePanel
