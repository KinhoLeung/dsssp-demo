import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { BleTransport, HidTransport, WebhmiClient } from '@/device'
import type { webhmi } from '@/device/proto/generated/webhmi'
import {
  getSelectedBleDevice,
  getSelectedHidDevice,
  setSelectedBleDevice,
  setSelectedHidDevice,
} from '@/device/selectedDevices'

const base64ToBytes = (b64: string) => {
  let normalized = b64.replace(/[\r\n\s]/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const pad = normalized.length % 4
  if (pad) normalized += '='.repeat(4 - pad)
  const bin = atob(normalized)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const cloneObject = <T>(value: T): T => {
  if (typeof structuredClone === 'function') return structuredClone(value)
  return JSON.parse(JSON.stringify(value)) as T
}

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  Object.prototype.toString.call(v) === '[object Object]'

const mergeDefinedObjects = (base: Record<string, unknown>, patch: Record<string, unknown>) => {
  const out: Record<string, unknown> = { ...base }
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    const prev = out[k]
    if (isPlainObject(prev) && isPlainObject(v)) {
      out[k] = mergeDefinedObjects(prev, v)
    } else {
      out[k] = v
    }
  }
  return out
}

const mergePatch = <T extends object>(base: T | undefined, patch: T): T => {
  const a = (base ?? {}) as unknown as Record<string, unknown>
  const b = patch as unknown as Record<string, unknown>
  return mergeDefinedObjects(a, b) as unknown as T
}

const applySectionPatch = <T extends object>(section: T | null | undefined, patch: object): T | null | undefined => {
  if (!section) return section
  return mergeDefinedObjects(section as unknown as Record<string, unknown>, patch as Record<string, unknown>) as unknown as T
}

const getEqRefByTarget = (db: webhmi.IGetDbResponse, target: webhmi.EqTarget): webhmi.IEq | null => {
  const d = db.db
  if (!d) return null
  switch (target) {
    case 0:
      return d.music?.eq ?? null
    case 1:
      return d.mic?.micAEq?.eq ?? null
    case 2:
      return d.mic?.micBEq?.eq ?? null
    case 3:
      return d.reverb?.eq ?? null
    case 4:
      return d.echo?.eq ?? null
    case 5:
      return d.mainOutput?.eq ?? null
    case 6:
      return d.subOutput?.eq ?? null
    case 7:
      return d.center?.eq ?? null
    case 8:
      return d.surround?.eq ?? null
    default:
      return null
  }
}

const applyEqBypassPatch = (db: webhmi.IGetDbResponse, target: webhmi.EqTarget, bypass: boolean) => {
  const eq = getEqRefByTarget(db, target)
  if (!eq) return db
  eq.bypass = bypass
  return db
}

const applyEqPointPatch = (db: webhmi.IGetDbResponse, target: webhmi.EqTarget, patch: webhmi.IEqPointPatch) => {
  const eq = getEqRefByTarget(db, target)
  if (!eq) return db
  if (!Array.isArray(eq.point)) eq.point = []
  if (typeof patch.index !== 'number') return db

  const idx = eq.point.findIndex((p) => p?.index === patch.index)
  if (idx >= 0) {
    eq.point[idx] = mergePatch(eq.point[idx] ?? {}, patch)
  } else {
    eq.point.push({ ...patch })
  }
  return db
}

export type DeviceSessionState = {
  connected: boolean
  transport: 'hid' | 'ble' | null
  busy: boolean
  error: string
  authOk: boolean | null
  authError: string
  db: webhmi.IGetDbResponse | null
  dbJson: string
  dbFetchId: number
  dirty: boolean
  flushing: boolean
  flushError: string
}

type PendingEqTarget = {
  bypass?: boolean
  points: Map<number, webhmi.IEqPointPatch>
}

type PendingPatches = {
  system?: webhmi.ISetSystemRequest
  music?: webhmi.ISetMusicRequest
  mic?: webhmi.ISetMicRequest
  reverb?: webhmi.ISetReverbRequest
  echo?: webhmi.ISetEchoRequest
  mainOutput?: webhmi.ISetMainOutputRequest
  subOutput?: webhmi.ISetSubOutputRequest
  center?: webhmi.ISetCenterRequest
  surround?: webhmi.ISetSurroundRequest
  eq: Map<number, PendingEqTarget>
}

export function useDeviceSession(
  options: { preferredTransport?: 'hid' | 'ble' | null; onTransportDisconnected?: () => void } = {},
) {
  const publicKeySpkiDer = useMemo(() => {
    const b64 = (import.meta.env.VITE_AUTH_PUBLIC_KEY_B64 as string | undefined) ?? ''
    if (!b64) return null
    try {
      return base64ToBytes(b64)
    } catch {
      return null
    }
  }, [])

  const clientRef = useRef<WebhmiClient | null>(null)
  const disconnectCleanupRef = useRef<(() => void) | null>(null)

  const pendingRef = useRef<PendingPatches>({ eq: new Map() })
  const flushTimerRef = useRef<number | null>(null)
  const flushInFlightRef = useRef(false)
  const flushRetryDelayRef = useRef<number>(0)
  const flushRequestedRef = useRef(false)
  const flushNowRef = useRef<() => Promise<void>>(async () => {
    throw new Error('flushNow not initialized')
  })

  const [state, setState] = useState<DeviceSessionState>({
    connected: false,
    transport: null,
    busy: false,
    error: '',
    authOk: null,
    authError: '',
    db: null,
    dbJson: '',
    dbFetchId: 0,
    dirty: false,
    flushing: false,
    flushError: '',
  })
  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const clearFlushTimer = () => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }

  const resetPending = useCallback(() => {
    pendingRef.current = { eq: new Map() }
    flushRetryDelayRef.current = 0
    flushRequestedRef.current = false
    clearFlushTimer()
    setState((s) => ({ ...s, dirty: false, flushError: '' }))
  }, [])

  const disconnect = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: '' }))
    try {
      clearFlushTimer()
      resetPending()

      disconnectCleanupRef.current?.()
      disconnectCleanupRef.current = null

      await clientRef.current?.disconnect()
      clientRef.current = null

      setState((s) => ({
        ...s,
        connected: false,
        transport: null,
        db: null,
        dbJson: '',
        dbFetchId: 0,
        authOk: null,
        authError: '',
        flushing: false,
        flushError: '',
      }))
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
    } finally {
      setState((s) => ({ ...s, busy: false }))
    }
  }, [resetPending])

  const handleTransportDisconnected = useCallback(async () => {
    if (!clientRef.current) return
    await disconnect()
    options.onTransportDisconnected?.()
  }, [disconnect, options.onTransportDisconnected])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  const doAuth = useCallback(
    async (targetClient: WebhmiClient) => {
      setState((s) => ({ ...s, authOk: null, authError: '' }))

      if (!publicKeySpkiDer) {
        setState((s) => ({ ...s, authOk: false, authError: 'Missing/invalid VITE_AUTH_PUBLIC_KEY_B64 in .env' }))
        return false
      }

      try {
        const ok = await targetClient.authVerify(publicKeySpkiDer)
        setState((s) => ({ ...s, authOk: ok, authError: ok ? '' : 'Signature verification failed' }))
        return ok
      } catch (e) {
        setState((s) => ({ ...s, authOk: false, authError: e instanceof Error ? e.message : String(e) }))
        return false
      }
    },
    [publicKeySpkiDer],
  )

  const refreshDb = useCallback(async () => {
    const targetClient = clientRef.current
    if (!targetClient) return

    setState((s) => ({ ...s, busy: true, error: '' }))
    try {
      const message = await targetClient.getDb()
      const db = targetClient.getDbToObject(message, { enums: Number }) as unknown as webhmi.IGetDbResponse
      const dbForPrint = targetClient.getDbToObject(message, { enums: String, longs: String })
      const pretty = JSON.stringify(dbForPrint, null, 2)
      console.warn('[GetDbResponse]', pretty)

      resetPending()
      setState((s) => ({ ...s, db, dbJson: pretty, dbFetchId: s.dbFetchId + 1 }))
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[GetDbResponse] failed', message)
      setState((s) => ({ ...s, error: message }))
    } finally {
      setState((s) => ({ ...s, busy: false }))
    }
  }, [resetPending])

  const setConnectedClient = useCallback((nextClient: WebhmiClient, transport: 'hid' | 'ble', cleanup: () => void) => {
    clientRef.current = nextClient
    disconnectCleanupRef.current?.()
    disconnectCleanupRef.current = cleanup
    setState((s) => ({
      ...s,
      connected: true,
      transport,
      db: null,
      dbJson: '',
      error: '',
      flushError: '',
      dirty: false,
      flushing: false,
      authOk: null,
      authError: '',
    }))
  }, [])

  const connectHid = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<boolean> => {
      if (!navigator.hid) {
        window.alert('当前浏览器不支持 WebHID。')
        return false
      }
      const interactive = options.interactive !== false

      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        const existing = getSelectedHidDevice()
        const device =
          existing ??
          (interactive
            ? (
                await navigator.hid.requestDevice({
                  filters: HID_DEVICE_PROFILES.map((p) => ({
                    vendorId: p.vendorId,
                    productId: p.productId,
                  })),
                })
              )[0]
            : null)

        if (!device) return false
        setSelectedHidDevice(device)

        const profile =
          HID_DEVICE_PROFILES.find((p) => p.vendorId === device.vendorId && p.productId === device.productId) ??
          HID_DEVICE_PROFILES[0]
        if (!profile) throw new Error('No HID device profile configured')

        const transport = new HidTransport(device, { reportId: profile.reportId, reportSize: profile.reportSize })
        const nextClient = new WebhmiClient(transport)
        await nextClient.connect()

        const onDisconnect = (event: HIDConnectionEvent) => {
          if (event.device !== device) return
          console.warn('[HID] disconnected')
          void handleTransportDisconnected()
        }
        navigator.hid.addEventListener('disconnect', onDisconnect)

        setConnectedClient(nextClient, 'hid', () => {
          navigator.hid.removeEventListener('disconnect', onDisconnect)
        })

        const ok = await doAuth(nextClient)
        if (!ok) return false
        await refreshDb()
        return true
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
        return false
      } finally {
        setState((s) => ({ ...s, busy: false }))
      }
    },
    [doAuth, handleTransportDisconnected, refreshDb, setConnectedClient],
  )

  const connectBle = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<boolean> => {
      if (!navigator.bluetooth) {
        window.alert('当前浏览器不支持 WebBLE。')
        return false
      }
      const interactive = options.interactive !== false
      const profile = BLE_DEVICE_PROFILES[0]
      if (!profile) {
        window.alert('未配置可用的 BLE 设备。')
        return false
      }

      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        const existing = getSelectedBleDevice()
        const device =
          existing ??
          (interactive
            ? await navigator.bluetooth.requestDevice({
                filters: BLE_DEVICE_PROFILES.map((p) => ({ services: [p.service] })),
                optionalServices: uniqueBleServices(),
              })
            : null)

        if (!device) return false
        setSelectedBleDevice(device)

        const transport = new BleTransport(device, {
          service: profile.service,
          characteristic: profile.characteristic,
          notify: profile.notify,
        })
        const nextClient = new WebhmiClient(transport)
        await nextClient.connect()

        const onDisconnect = () => {
          console.warn('[BLE] disconnected')
          void handleTransportDisconnected()
        }
        device.addEventListener('gattserverdisconnected', onDisconnect)

        const gattPollId = window.setInterval(() => {
          const connected = device.gatt?.connected
          if (connected === true) return
          window.clearInterval(gattPollId)
          console.warn('[BLE] gatt.connected=false')
          void handleTransportDisconnected()
        }, 200)

        setConnectedClient(nextClient, 'ble', () => {
          device.removeEventListener('gattserverdisconnected', onDisconnect)
          window.clearInterval(gattPollId)
        })

        const ok = await doAuth(nextClient)
        if (!ok) return false
        await refreshDb()
        return true
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
        return false
      } finally {
        setState((s) => ({ ...s, busy: false }))
      }
    },
    [doAuth, handleTransportDisconnected, refreshDb, setConnectedClient],
  )

  const hasPending = () => {
    const p = pendingRef.current
    return (
      !!p.system ||
      !!p.music ||
      !!p.mic ||
      !!p.reverb ||
      !!p.echo ||
      !!p.mainOutput ||
      !!p.subOutput ||
      !!p.center ||
      !!p.surround ||
      p.eq.size > 0
    )
  }

  const updateDbDraft = (updater: (draft: webhmi.IGetDbResponse) => webhmi.IGetDbResponse) => {
    setState((s) => {
      if (!s.db) return s
      const nextDb = updater(cloneObject(s.db))
      const nextJson = s.dbJson ? JSON.stringify(nextDb, null, 2) : s.dbJson
      return { ...s, db: nextDb, dbJson: nextJson }
    })
  }

  const scheduleFlush = useCallback((delayMs: number) => {
    clearFlushTimer()
    flushTimerRef.current = window.setTimeout(() => {
      void flushNowRef.current()
    }, delayMs)
  }, [])

  const flushNow = useCallback(async () => {
    const targetClient = clientRef.current
    if (!targetClient) return
    if (!hasPending()) return
    if (stateRef.current.authOk !== true) return

    if (flushInFlightRef.current) {
      flushRequestedRef.current = true
      return
    }

    flushInFlightRef.current = true
    setState((s) => ({ ...s, flushing: true }))

    try {
      const p = pendingRef.current
      const ops: Array<Promise<void>> = []

      if (p.system) ops.push(targetClient.setSystem(p.system))
      if (p.music) ops.push(targetClient.setMusic(p.music))
      if (p.mic) ops.push(targetClient.setMic(p.mic))
      if (p.reverb) ops.push(targetClient.setReverb(p.reverb))
      if (p.echo) ops.push(targetClient.setEcho(p.echo))
      if (p.mainOutput) ops.push(targetClient.setMainOutput(p.mainOutput))
      if (p.subOutput) ops.push(targetClient.setSubOutput(p.subOutput))
      if (p.center) ops.push(targetClient.setCenter(p.center))
      if (p.surround) ops.push(targetClient.setSurround(p.surround))

      if (p.eq.size > 0) {
        const eq = Array.from(p.eq.entries()).map(([target, entry]) => ({
          target,
          bypass: entry.bypass,
          point: Array.from(entry.points.values()),
        }))
        ops.push(targetClient.setEq({ eq }))
      }

      for (const op of ops) await op

      resetPending()
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.warn('[Flush] failed:', message)
      setState((s) => ({ ...s, flushError: message, dirty: true }))

      const next = flushRetryDelayRef.current ? Math.min(flushRetryDelayRef.current * 2, 10_000) : 500
      flushRetryDelayRef.current = next
      scheduleFlush(next)
    } finally {
      setState((s) => ({ ...s, flushing: false }))
      flushInFlightRef.current = false
      if (flushRequestedRef.current) {
        flushRequestedRef.current = false
        scheduleFlush(0)
      }
    }
  }, [resetPending, scheduleFlush])

  useEffect(() => {
    flushNowRef.current = flushNow
  }, [flushNow])

  const queueSystem = useCallback(
    (patch: webhmi.ISetSystemRequest) => {
      pendingRef.current.system = mergePatch(pendingRef.current.system, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.system = applySectionPatch(db.db.system, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueMusic = useCallback(
    (patch: webhmi.ISetMusicRequest) => {
      pendingRef.current.music = mergePatch(pendingRef.current.music, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.music = applySectionPatch(db.db.music, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueMic = useCallback(
    (patch: webhmi.ISetMicRequest) => {
      pendingRef.current.mic = mergePatch(pendingRef.current.mic, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.mic = applySectionPatch(db.db.mic, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueReverb = useCallback(
    (patch: webhmi.ISetReverbRequest) => {
      pendingRef.current.reverb = mergePatch(pendingRef.current.reverb, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.reverb = applySectionPatch(db.db.reverb, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueEcho = useCallback(
    (patch: webhmi.ISetEchoRequest) => {
      pendingRef.current.echo = mergePatch(pendingRef.current.echo, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.echo = applySectionPatch(db.db.echo, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueMainOutput = useCallback(
    (patch: webhmi.ISetMainOutputRequest) => {
      pendingRef.current.mainOutput = mergePatch(pendingRef.current.mainOutput, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.mainOutput = applySectionPatch(db.db.mainOutput, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueSubOutput = useCallback(
    (patch: webhmi.ISetSubOutputRequest) => {
      pendingRef.current.subOutput = mergePatch(pendingRef.current.subOutput, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.subOutput = applySectionPatch(db.db.subOutput, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueCenter = useCallback(
    (patch: webhmi.ISetCenterRequest) => {
      pendingRef.current.center = mergePatch(pendingRef.current.center, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.center = applySectionPatch(db.db.center, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueSurround = useCallback(
    (patch: webhmi.ISetSurroundRequest) => {
      pendingRef.current.surround = mergePatch(pendingRef.current.surround, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.surround = applySectionPatch(db.db.surround, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueEqBypass = useCallback(
    (target: webhmi.EqTarget, bypass: boolean) => {
      const entry = pendingRef.current.eq.get(target) ?? { points: new Map() }
      entry.bypass = bypass
      pendingRef.current.eq.set(target, entry)

      updateDbDraft((db) => applyEqBypassPatch(db, target, bypass))
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const queueEqPoint = useCallback(
    (target: webhmi.EqTarget, patch: webhmi.IEqPointPatch) => {
      if (typeof patch.index !== 'number') throw new Error('EqPointPatch.index is required')

      const entry = pendingRef.current.eq.get(target) ?? { points: new Map() }
      const prev = entry.points.get(patch.index) ?? { index: patch.index }
      entry.points.set(patch.index, mergePatch(prev, patch))
      pendingRef.current.eq.set(target, entry)

      updateDbDraft((db) => applyEqPointPatch(db, target, patch))
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      scheduleFlush(500)
    },
    [scheduleFlush],
  )

  const didAutoConnect = useRef(false)
  useEffect(() => {
    if (didAutoConnect.current) return
    didAutoConnect.current = true
    if (options.preferredTransport === 'hid') void connectHid({ interactive: false })
    if (options.preferredTransport === 'ble') void connectBle({ interactive: false })
  }, [connectBle, connectHid, options.preferredTransport])

  return {
    state,
    actions: {
      connectHid,
      connectBle,
      disconnect,
      refreshDb,
      flushNow,
      queueSystem,
      queueMusic,
      queueMic,
      queueReverb,
      queueEcho,
      queueMainOutput,
      queueSubOutput,
      queueCenter,
      queueSurround,
      queueEqBypass,
      queueEqPoint,
      resetPending,
    },
  }
}
