import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  BLE_DEVICE_PROFILES,
  HID_DEVICE_PROFILES,
  uniqueBleServices,
} from '@/configs/deviceProfiles'
import { BleTransport, HidTransport, WebhmiClient } from '@/device'
import { MsgId } from '@/device/proto/msgId'
import { getWebhmiNamespace } from '@/device/proto/webhmi'
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

const getEqPointRefByTargetAndIndex = (
  db: webhmi.IGetDbResponse,
  target: webhmi.EqTarget,
  index: number,
): webhmi.IEqPoint | null => {
  const eq = getEqRefByTarget(db, target)
  const points = eq?.point
  if (!Array.isArray(points)) return null
  return points.find((p) => p?.index === index) ?? null
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

const applyEqPointDefaults = (db: webhmi.IGetDbResponse, target: webhmi.EqTarget, indices?: number[]) => {
  const eq = getEqRefByTarget(db, target)
  if (!eq?.point?.length) return db

  const allow = indices?.length ? new Set(indices) : null
  for (const p of eq.point) {
    if (!p) continue
    const index = p.index
    if (allow && (typeof index !== 'number' || !allow.has(index))) continue

    if (typeof p.defaultType === 'number') p.type = p.defaultType
    if (typeof p.defaultFreq === 'number') p.freq = p.defaultFreq
    if (typeof p.defaultGain === 'number') p.gain = p.defaultGain
    if (typeof p.defaultQ === 'number') p.q = p.defaultQ
  }

  return db
}

const hasValue = (v: unknown): v is NonNullable<unknown> => v !== undefined && v !== null

const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

const buildEqPatchesFromPending = (
  pendingEq: Map<number, PendingEqTarget>,
  baseDb: webhmi.IGetDbResponse | null,
): webhmi.IEqPatch[] => {
  const out: webhmi.IEqPatch[] = []

  for (const [targetRaw, entry] of pendingEq.entries()) {
    const target = targetRaw as webhmi.EqTarget
    const baseEq = baseDb ? getEqRefByTarget(baseDb, target) : null

    const patch: webhmi.IEqPatch = { target }

    if (typeof entry.bypass === 'boolean') {
      const baseBypass = !!baseEq?.bypass
      if (entry.bypass !== baseBypass) patch.bypass = entry.bypass
    }

    const points: webhmi.IEqPointPatch[] = []
    for (const pointPatch of entry.points.values()) {
      if (typeof pointPatch.index !== 'number') continue
      const basePoint = baseEq?.point?.find((p) => p?.index === pointPatch.index) ?? null

      const minimized: webhmi.IEqPointPatch = { index: pointPatch.index }

      if (hasValue(pointPatch.type) && (basePoint == null || pointPatch.type !== basePoint.type)) {
        minimized.type = pointPatch.type
      }
      if (hasValue(pointPatch.freq) && (basePoint == null || pointPatch.freq !== basePoint.freq)) {
        minimized.freq = pointPatch.freq
      }
      if (
        hasValue(pointPatch.gain) &&
        (basePoint == null || !hasValue(basePoint.gain) || !nearlyEqual(pointPatch.gain, basePoint.gain))
      ) {
        minimized.gain = pointPatch.gain
      }
      if (hasValue(pointPatch.q) && (basePoint == null || !hasValue(basePoint.q) || !nearlyEqual(pointPatch.q, basePoint.q))) {
        minimized.q = pointPatch.q
      }

      if (Object.keys(minimized).length > 1) points.push(minimized)
    }

    if (points.length > 0) patch.point = points
    if (patch.bypass !== undefined || (patch.point?.length ?? 0) > 0) out.push(patch)
  }

  return out
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
  const USER_DEBOUNCE_MS = 200
  const USER_THROTTLE_MS = 200

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
  const baseDbRef = useRef<webhmi.IGetDbResponse | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  const userBurstStartAtRef = useRef<number | null>(null)
  const userLastChangeAtRef = useRef<number | null>(null)
  const lastTxAtRef = useRef<number | null>(null)
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

  const hasPending = useCallback(() => {
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
  }, [])

  const scheduleFlush = useCallback((delayMs: number) => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    flushTimerRef.current = window.setTimeout(() => {
      void flushNowRef.current()
    }, delayMs)
  }, [])

  const resetPending = useCallback(() => {
    pendingRef.current = { eq: new Map() }
    flushRetryDelayRef.current = 0
    flushRequestedRef.current = false
    userBurstStartAtRef.current = null
    userLastChangeAtRef.current = null
    lastTxAtRef.current = null
    clearFlushTimer()
    setState((s) => ({ ...s, dirty: false, flushError: '' }))
  }, [])

  const disconnect = useCallback(async () => {
    setState((s) => ({ ...s, busy: true, error: '' }))
    try {
      clearFlushTimer()
      resetPending()
      baseDbRef.current = null

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
        console.info('[useDeviceSession] Starting authVerify...')
        const ok = await targetClient.authVerify(publicKeySpkiDer)
        setState((s) => ({ ...s, authOk: ok, authError: ok ? '' : 'Signature verification failed' }))
        console.info('[useDeviceSession] authVerify result:', ok)
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
      console.info('[useDeviceSession] Requesting database (GetDb)...')
      const message = await targetClient.getDb()
      const db = targetClient.getDbToObject(message, { enums: Number }) as unknown as webhmi.IGetDbResponse
      const dbForPrint = targetClient.getDbToObject(message, { enums: String, longs: String })
      const pretty = JSON.stringify(dbForPrint, null, 2)

      resetPending()
      baseDbRef.current = cloneObject(db)
      setState((s) => ({ ...s, db, dbJson: pretty, dbFetchId: s.dbFetchId + 1 }))
      console.info('[useDeviceSession] Database refreshed successfully.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[GetDbResponse] failed', message)
      setState((s) => ({ ...s, error: message }))
    } finally {
      setState((s) => ({ ...s, busy: false }))
    }
  }, [resetPending])

  const resetEq = useCallback(async (target: webhmi.EqTarget, indices?: number[]) => {
    const targetClient = clientRef.current
    if (!targetClient) return
    if (stateRef.current.authOk !== true) return

    setState((s) => ({ ...s, busy: true, error: '' }))
    try {
      const index = indices?.length ? indices : []
      await targetClient.resetEq({ target, index })

      const pending = pendingRef.current.eq.get(target)
      if (pending) {
        pending.points.clear()
        if (pending.bypass === undefined) pendingRef.current.eq.delete(target)
      }
      if (!hasPending()) clearFlushTimer()

      if (baseDbRef.current) applyEqPointDefaults(baseDbRef.current, target, indices)

      setState((s) => {
        if (!s.db) {
          return { ...s, busy: false, dirty: hasPending(), flushError: '', dbFetchId: s.dbFetchId + 1 }
        }
        const nextDb = applyEqPointDefaults(cloneObject(s.db), target, indices)
        const nextJson = s.dbJson ? JSON.stringify(nextDb, null, 2) : s.dbJson
        return {
          ...s,
          busy: false,
          db: nextDb,
          dbJson: nextJson,
          dbFetchId: s.dbFetchId + 1,
          dirty: hasPending(),
          flushError: '',
        }
      })
    } catch (e) {
      setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
    } finally {
      setState((s) => ({ ...s, busy: false }))
    }
  }, [hasPending])

  const resetEqPointToDefault = useCallback(
    async (target: webhmi.EqTarget, index: number) => {
      const targetClient = clientRef.current
      if (!targetClient) return
      if (stateRef.current.authOk !== true) return

      const sourceDb = stateRef.current.db ?? baseDbRef.current
      if (!sourceDb) return

      const point = getEqPointRefByTargetAndIndex(sourceDb, target, index)
      if (!point) return

      const patch: webhmi.IEqPointPatch = { index }
      if (typeof point.defaultType === 'number') patch.type = point.defaultType
      if (typeof point.defaultFreq === 'number') patch.freq = point.defaultFreq
      if (typeof point.defaultGain === 'number') patch.gain = point.defaultGain
      if (typeof point.defaultQ === 'number') patch.q = point.defaultQ
      if (Object.keys(patch).length <= 1) return

      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        await targetClient.setEq({ eq: [{ target, point: [patch] }] })

        const pending = pendingRef.current.eq.get(target)
        if (pending) {
          pending.points.delete(index)
          if (pending.points.size === 0 && pending.bypass === undefined) pendingRef.current.eq.delete(target)
        }
        if (!hasPending()) clearFlushTimer()

        if (baseDbRef.current) applyEqPointPatch(baseDbRef.current, target, patch)

        setState((s) => {
          if (!s.db) return { ...s, dirty: hasPending(), flushError: '', dbFetchId: s.dbFetchId + 1 }
          const nextDb = applyEqPointPatch(cloneObject(s.db), target, patch)
          const nextJson = s.dbJson ? JSON.stringify(nextDb, null, 2) : s.dbJson
          return { ...s, db: nextDb, dbJson: nextJson, dbFetchId: s.dbFetchId + 1, dirty: hasPending(), flushError: '' }
        })
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e) }))
      } finally {
        setState((s) => ({ ...s, busy: false }))
      }
    },
    [hasPending],
  )

  const setConnectedClient = useCallback((nextClient: WebhmiClient, transport: 'hid' | 'ble', cleanup: () => void) => {
    const pb = getWebhmiNamespace()
    const unsub = nextClient.onEvent(({ msgId, payload }) => {

      updateDbDraft((db) => {
        if (!db.db) return db
        try {
          switch (msgId) {
            case MsgId.SetMusic: {
              const msg = pb.SetMusicRequest.decode(payload)
              const patch = pb.SetMusicRequest.toObject(msg, { defaults: false })
              db.db.music = applySectionPatch(db.db.music, patch) ?? db.db.music
              break
            }
            case MsgId.SetEq: {
              const msg = pb.SetEqRequest.decode(payload)
              const patch = pb.SetEqRequest.toObject(msg, { defaults: false })
              if (patch.eq) {
                for (const eqPatch of patch.eq) {
                  if (typeof eqPatch.target !== 'number') continue
                  if (typeof eqPatch.bypass === 'boolean') applyEqBypassPatch(db, eqPatch.target as webhmi.EqTarget, eqPatch.bypass)
                  for (const pointPatch of eqPatch.point ?? []) {
                    applyEqPointPatch(db, eqPatch.target as webhmi.EqTarget, pointPatch)
                  }
                }
              }
              break
            }
            case MsgId.SetSystem: {
              const msg = pb.SetSystemRequest.decode(payload)
              const patch = pb.SetSystemRequest.toObject(msg, { defaults: false })
              db.db.system = applySectionPatch(db.db.system, patch) ?? db.db.system
              break
            }
            case MsgId.SetMic: {
              const msg = pb.SetMicRequest.decode(payload)
              const patch = pb.SetMicRequest.toObject(msg, { defaults: false })
              db.db.mic = applySectionPatch(db.db.mic, patch) ?? db.db.mic
              break
            }
            case MsgId.SetReverb: {
              const msg = pb.SetReverbRequest.decode(payload)
              const patch = pb.SetReverbRequest.toObject(msg, { defaults: false })
              db.db.reverb = applySectionPatch(db.db.reverb, patch) ?? db.db.reverb
              break
            }
            case MsgId.SetEcho: {
              const msg = pb.SetEchoRequest.decode(payload)
              const patch = pb.SetEchoRequest.toObject(msg, { defaults: false })
              db.db.echo = applySectionPatch(db.db.echo, patch) ?? db.db.echo
              break
            }
            case MsgId.SetMainOutput: {
              const msg = pb.SetMainOutputRequest.decode(payload)
              const patch = pb.SetMainOutputRequest.toObject(msg, { defaults: false })
              db.db.mainOutput = applySectionPatch(db.db.mainOutput, patch) ?? db.db.mainOutput
              break
            }
            case MsgId.SetSubOutput: {
              const msg = pb.SetSubOutputRequest.decode(payload)
              const patch = pb.SetSubOutputRequest.toObject(msg, { defaults: false })
              db.db.subOutput = applySectionPatch(db.db.subOutput, patch) ?? db.db.subOutput
              break
            }
            case MsgId.SetCenter: {
              const msg = pb.SetCenterRequest.decode(payload)
              const patch = pb.SetCenterRequest.toObject(msg, { defaults: false })
              db.db.center = applySectionPatch(db.db.center, patch) ?? db.db.center
              break
            }
            case MsgId.SetSurround: {
              const msg = pb.SetSurroundRequest.decode(payload)
              const patch = pb.SetSurroundRequest.toObject(msg, { defaults: false })
              db.db.surround = applySectionPatch(db.db.surround, patch) ?? db.db.surround
              break
            }
            case MsgId.SaveMode: {
              const msg = pb.SaveModeRequest.decode(payload)
              const patch = pb.SaveModeRequest.toObject(msg, { defaults: false })
              if (patch.currentModeIndex !== undefined) {
                if (!db.db.system) db.db.system = {}
                db.db.system.currentModeIndex = patch.currentModeIndex
              }
              break
            }
          }
        } catch (e) {
          console.error(`[web:rx] failed to decode EVENT msgId=0x${msgId.toString(16)}:`, e)
        }
        return db
      })
    })

    clientRef.current = nextClient
    disconnectCleanupRef.current?.()
    disconnectCleanupRef.current = () => {
      unsub()
      cleanup()
    }
    baseDbRef.current = null
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
        window.alert('WebHID is not supported by this browser.')
        return false
      }
      if (clientRef.current) await disconnect()
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
                  usagePage: p.usagePage,
                  usage: p.usage,
                })),
              })
            )[0]
            : null)

        if (!device) return false
        setSelectedHidDevice(device)

        const profile =
          HID_DEVICE_PROFILES.find((p) =>
            p.vendorId === device.vendorId &&
            p.productId === device.productId &&
            device.collections.some(c => c.usagePage === p.usagePage && c.usage === p.usage)
          ) ?? HID_DEVICE_PROFILES[0]
        if (!profile) throw new Error('No HID device profile configured')

        const transport = new HidTransport(device, { reportId: profile.reportId, reportSize: profile.reportSize })
        const nextClient = new WebhmiClient(transport)
        await nextClient.connect()

        const onDisconnect = (event: HIDConnectionEvent) => {
          if (event.device !== device) return
          console.warn('[HID] disconnected')
          void handleTransportDisconnected()
        }
        navigator.hid?.addEventListener('disconnect', onDisconnect)

        setConnectedClient(nextClient, 'hid', () => {
          navigator.hid?.removeEventListener('disconnect', onDisconnect)
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
    [disconnect, doAuth, handleTransportDisconnected, refreshDb, setConnectedClient],
  )

  const connectBle = useCallback(
    async (options: { interactive?: boolean } = {}): Promise<boolean> => {
      if (!navigator.bluetooth) {
        window.alert('WebBLE is not supported by this browser.')
        return false
      }
      if (clientRef.current) await disconnect()
      const interactive = options.interactive !== false
      if (BLE_DEVICE_PROFILES.length === 0) {
        window.alert('No BLE device profiles configured.')
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

        const profile =
          BLE_DEVICE_PROFILES.find((p) => device.name?.includes(p.label)) ?? BLE_DEVICE_PROFILES[0]

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

  const updateDbDraft = (updater: (draft: webhmi.IGetDbResponse) => webhmi.IGetDbResponse) => {
    setState((s) => {
      if (!s.db) return s
      const nextDb = updater(cloneObject(s.db))
      const nextJson = s.dbJson ? JSON.stringify(nextDb, null, 2) : s.dbJson
      return { ...s, db: nextDb, dbJson: nextJson, dbFetchId: s.dbFetchId + 1 }
    })
  }

  const rescheduleUserFlush = useCallback(() => {
    if (flushInFlightRef.current) {
      flushRequestedRef.current = true
      return
    }
    if (!clientRef.current) return
    if (!hasPending()) return
    if (stateRef.current.authOk !== true) return

    const now = Date.now()
    const burstStartAt = userBurstStartAtRef.current ?? now
    const lastChangeAt = userLastChangeAtRef.current ?? now
    const burstAgeMs = now - burstStartAt
    const sinceTxMs = lastTxAtRef.current == null ? Number.POSITIVE_INFINITY : now - lastTxAtRef.current

    if (burstAgeMs >= USER_THROTTLE_MS && sinceTxMs >= USER_THROTTLE_MS) {
      scheduleFlush(0)
      return
    }

    const debounceDelay = Math.max(0, lastChangeAt + USER_DEBOUNCE_MS - now)
    scheduleFlush(debounceDelay)
  }, [hasPending, scheduleFlush])

  const markUserChange = useCallback(() => {
    const now = Date.now()
    userLastChangeAtRef.current = now
    if (userBurstStartAtRef.current == null) userBurstStartAtRef.current = now
    rescheduleUserFlush()
  }, [rescheduleUserFlush])

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

    let flushSucceeded = false
    let snapshot: PendingPatches | null = null

    const mergePendingAfterFailure = (sent: PendingPatches) => {
      const current = pendingRef.current
      const mergedEq = new Map<number, PendingEqTarget>()

      const mergeEqTarget = (base: PendingEqTarget | undefined, patch: PendingEqTarget | undefined): PendingEqTarget => {
        const basePoints = base?.points ?? new Map<number, webhmi.IEqPointPatch>()
        const patchPoints = patch?.points ?? new Map<number, webhmi.IEqPointPatch>()
        const points = new Map<number, webhmi.IEqPointPatch>()
        for (const [idx, pp] of basePoints.entries()) points.set(idx, pp)
        for (const [idx, pp] of patchPoints.entries()) {
          const prev = points.get(idx) ?? { index: idx }
          points.set(idx, mergePatch(prev, pp))
        }
        const out: PendingEqTarget = { points }
        if (typeof base?.bypass === 'boolean') out.bypass = base.bypass
        if (typeof patch?.bypass === 'boolean') out.bypass = patch.bypass
        return out
      }

      for (const [t, entry] of sent.eq.entries()) mergedEq.set(t, mergeEqTarget(undefined, entry))
      for (const [t, entry] of current.eq.entries()) mergedEq.set(t, mergeEqTarget(mergedEq.get(t), entry))

      const merged: PendingPatches = { eq: mergedEq }
      if (sent.system || current.system) merged.system = mergePatch(sent.system, current.system ?? {})
      if (sent.music || current.music) merged.music = mergePatch(sent.music, current.music ?? {})
      if (sent.mic || current.mic) merged.mic = mergePatch(sent.mic, current.mic ?? {})
      if (sent.reverb || current.reverb) merged.reverb = mergePatch(sent.reverb, current.reverb ?? {})
      if (sent.echo || current.echo) merged.echo = mergePatch(sent.echo, current.echo ?? {})
      if (sent.mainOutput || current.mainOutput) merged.mainOutput = mergePatch(sent.mainOutput, current.mainOutput ?? {})
      if (sent.subOutput || current.subOutput) merged.subOutput = mergePatch(sent.subOutput, current.subOutput ?? {})
      if (sent.center || current.center) merged.center = mergePatch(sent.center, current.center ?? {})
      if (sent.surround || current.surround) merged.surround = mergePatch(sent.surround, current.surround ?? {})

      pendingRef.current = merged
    }

    try {
      const p = pendingRef.current
      snapshot = p
      pendingRef.current = { eq: new Map() }
      clearFlushTimer()
      flushRequestedRef.current = false
      userBurstStartAtRef.current = null
      userLastChangeAtRef.current = null
      lastTxAtRef.current = Date.now()

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

      let sentEq: webhmi.IEqPatch[] = []
      if (p.eq.size > 0) {
        sentEq = buildEqPatchesFromPending(p.eq, baseDbRef.current)
        if (sentEq.length > 0) ops.push(targetClient.setEq({ eq: sentEq }))
      }

      for (const op of ops) await op
      flushSucceeded = true

      const baseDb = baseDbRef.current
      if (baseDb?.db) {
        if (p.system) baseDb.db.system = applySectionPatch(baseDb.db.system, p.system) ?? baseDb.db.system
        if (p.music) baseDb.db.music = applySectionPatch(baseDb.db.music, p.music) ?? baseDb.db.music
        if (p.mic) baseDb.db.mic = applySectionPatch(baseDb.db.mic, p.mic) ?? baseDb.db.mic
        if (p.reverb) baseDb.db.reverb = applySectionPatch(baseDb.db.reverb, p.reverb) ?? baseDb.db.reverb
        if (p.echo) baseDb.db.echo = applySectionPatch(baseDb.db.echo, p.echo) ?? baseDb.db.echo
        if (p.mainOutput) baseDb.db.mainOutput = applySectionPatch(baseDb.db.mainOutput, p.mainOutput) ?? baseDb.db.mainOutput
        if (p.subOutput) baseDb.db.subOutput = applySectionPatch(baseDb.db.subOutput, p.subOutput) ?? baseDb.db.subOutput
        if (p.center) baseDb.db.center = applySectionPatch(baseDb.db.center, p.center) ?? baseDb.db.center
        if (p.surround) baseDb.db.surround = applySectionPatch(baseDb.db.surround, p.surround) ?? baseDb.db.surround
      }
      if (baseDb && sentEq.length > 0) {
        for (const eqPatch of sentEq) {
          if (typeof eqPatch.target !== 'number') continue
          if (typeof eqPatch.bypass === 'boolean') applyEqBypassPatch(baseDb, eqPatch.target as webhmi.EqTarget, eqPatch.bypass)
          for (const pointPatch of eqPatch.point ?? []) {
            applyEqPointPatch(baseDb, eqPatch.target as webhmi.EqTarget, pointPatch)
          }
        }
      }

      flushRetryDelayRef.current = 0
      if (!hasPending()) {
        setState((s) => ({ ...s, dirty: false, flushError: '' }))
      } else {
        setState((s) => ({ ...s, dirty: true, flushError: '' }))
      }
    } catch (e) {
      // Put the snapshot back so we don't drop user changes on a failed flush.
      // Note: This may re-send some patches if the transport failed after partially writing.
      // The protocol is patch-based so re-sending is acceptable.
      if (snapshot) mergePendingAfterFailure(snapshot)
      const message = e instanceof Error ? e.message : String(e)
      console.warn('[Flush] failed:', message)
      setState((s) => ({ ...s, flushError: message, dirty: true }))

      const next = flushRetryDelayRef.current ? Math.min(flushRetryDelayRef.current * 2, 10_000) : 500
      flushRetryDelayRef.current = next
      scheduleFlush(next)
    } finally {
      setState((s) => ({ ...s, flushing: false }))
      flushInFlightRef.current = false
      if (flushSucceeded && (flushRequestedRef.current || hasPending())) rescheduleUserFlush()
    }
  }, [hasPending, rescheduleUserFlush, scheduleFlush])

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
      markUserChange()
    },
    [markUserChange],
  )

  const queueMusic = useCallback(
    (patch: webhmi.ISetMusicRequest) => {
      pendingRef.current.music = mergePatch(pendingRef.current.music, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.music = applySectionPatch(db.db.music, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueMic = useCallback(
    (patch: webhmi.ISetMicRequest) => {
      pendingRef.current.mic = mergePatch(pendingRef.current.mic, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.mic = applySectionPatch(db.db.mic, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueReverb = useCallback(
    (patch: webhmi.ISetReverbRequest) => {
      pendingRef.current.reverb = mergePatch(pendingRef.current.reverb, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.reverb = applySectionPatch(db.db.reverb, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueEcho = useCallback(
    (patch: webhmi.ISetEchoRequest) => {
      pendingRef.current.echo = mergePatch(pendingRef.current.echo, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.echo = applySectionPatch(db.db.echo, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueMainOutput = useCallback(
    (patch: webhmi.ISetMainOutputRequest) => {
      pendingRef.current.mainOutput = mergePatch(pendingRef.current.mainOutput, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.mainOutput = applySectionPatch(db.db.mainOutput, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueSubOutput = useCallback(
    (patch: webhmi.ISetSubOutputRequest) => {
      pendingRef.current.subOutput = mergePatch(pendingRef.current.subOutput, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.subOutput = applySectionPatch(db.db.subOutput, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueCenter = useCallback(
    (patch: webhmi.ISetCenterRequest) => {
      pendingRef.current.center = mergePatch(pendingRef.current.center, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.center = applySectionPatch(db.db.center, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const queueSurround = useCallback(
    (patch: webhmi.ISetSurroundRequest) => {
      pendingRef.current.surround = mergePatch(pendingRef.current.surround, patch)
      updateDbDraft((db) => {
        if (db.db) db.db.surround = applySectionPatch(db.db.surround, patch)
        return db
      })
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
  )

  const switchCurrentMode = useCallback(
    async (index: number) => {
      const targetClient = clientRef.current
      if (!targetClient) return
      if (stateRef.current.authOk !== true) return

      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        const response = await targetClient.switchCurrentMode({ currentModeIndex: index })
        if (response.db) {
          const nextDb = cloneObject(stateRef.current.db)
          if (nextDb) {
            nextDb.db = response.db as webhmi.IDeviceDb
            const dbForPrint = targetClient.getDbToObject(nextDb as any, { enums: String, longs: String })
            const pretty = JSON.stringify(dbForPrint, null, 2)

            resetPending()
            baseDbRef.current = cloneObject(nextDb)
            setState((s) => ({
              ...s,
              db: nextDb,
              dbJson: pretty,
              dbFetchId: s.dbFetchId + 1,
              busy: false,
              error: '',
              dirty: false,
            }))
          }
        }
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), busy: false }))
      }
    },
    [resetPending],
  )

  const saveMode = useCallback(
    async (index: number) => {
      const targetClient = clientRef.current
      if (!targetClient) return
      if (stateRef.current.authOk !== true) return

      setState((s) => ({ ...s, busy: true, error: '' }))
      try {
        await targetClient.saveMode({ currentModeIndex: index })
        setState((s) => ({ ...s, busy: false, error: '' }))
      } catch (e) {
        setState((s) => ({ ...s, error: e instanceof Error ? e.message : String(e), busy: false }))
      }
    },
    [],
  )

  const queueEqBypass = useCallback(
    (target: webhmi.EqTarget, bypass: boolean) => {
      const entry: PendingEqTarget = pendingRef.current.eq.get(target) ?? { points: new Map() }
      entry.bypass = bypass
      pendingRef.current.eq.set(target, entry)

      updateDbDraft((db) => applyEqBypassPatch(db, target, bypass))
      setState((s) => ({ ...s, dirty: true, flushError: '' }))
      markUserChange()
    },
    [markUserChange],
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
      markUserChange()
    },
    [markUserChange],
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
      resetEq,
      resetEqPointToDefault,
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
      switchCurrentMode,
      saveMode,
      resetPending,
    },
  }
}
