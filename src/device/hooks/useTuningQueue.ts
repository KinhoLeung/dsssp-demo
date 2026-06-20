import { useCallback, useEffect, useRef, useState } from 'react'

import type { WebhmiClient } from '@/device'
import type { webhmi } from '@/device/proto/generated/webhmi'
import {
  applyEqBypassPatch,
  applyEqPointDefaults,
  applyEqPointPatch,
  applySectionPatch,
  buildEqPatchesFromPending,
  cloneObject,
  getEqPendingKey,
  getEqPointRefByTargetAndIndex,
  mergePatch,
  type PendingEqTarget,
} from '@/device/utils/dbHelpers'

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
  eq: Map<string, PendingEqTarget>
}

export type QueueEqPointOptions = {
  syncDraft?: boolean
}

export function useTuningQueue(options: { authOk: boolean | null } = { authOk: null }) {
  const USER_DEBOUNCE_MS = 200
  const USER_THROTTLE_MS = 200

  const pendingRef = useRef<PendingPatches>({ eq: new Map() })
  const baseDbRef = useRef<webhmi.IDeviceConfig | null>(null)
  const flushTimerRef = useRef<number | null>(null)
  const userBurstStartAtRef = useRef<number | null>(null)
  const userLastChangeAtRef = useRef<number | null>(null)
  const lastTxAtRef = useRef<number | null>(null)
  const flushInFlightRef = useRef(false)
  const flushRetryDelayRef = useRef<number>(0)
  const flushRequestedRef = useRef(false)

  const [db, setDb] = useState<webhmi.IDeviceConfig | null>(null)
  const [dbFetchId, setDbFetchId] = useState<number>(0)
  const [flushing, setFlushing] = useState(false)
  const [flushError, setFlushError] = useState('')

  const flushNowRef = useRef<(client: WebhmiClient) => Promise<void>>(async () => {
    throw new Error('flushNow not initialized')
  })

  const clearFlushTimer = useCallback(() => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
  }, [])

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

  const scheduleFlush = useCallback((client: WebhmiClient, delayMs: number) => {
    if (flushTimerRef.current) {
      window.clearTimeout(flushTimerRef.current)
      flushTimerRef.current = null
    }
    flushTimerRef.current = window.setTimeout(() => {
      void flushNowRef.current(client)
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
    setFlushError('')
  }, [clearFlushTimer])

  const clearDb = useCallback(() => {
    baseDbRef.current = null
    setDb(null)
    setDbFetchId(0)
    setFlushing(false)
    setFlushError('')
  }, [])

  const updateDbDraft = useCallback((updater: (draft: webhmi.IDeviceConfig) => webhmi.IDeviceConfig) => {
    setDb((currentDb) => {
      if (!currentDb) return null
      const nextDb = updater(cloneObject(currentDb))
      setDbFetchId((id) => id + 1)
      return nextDb
    })
  }, [])

  const refreshDb = useCallback(async (client: WebhmiClient) => {
    setFlushing(false)
    setFlushError('')
    try {
      console.info('[useTuningQueue] Requesting database (GetDb)...')
      const message = await client.getDb()
      const fetchedDb = client.getDbToObject(message, { enums: Number }) as unknown as webhmi.IDeviceConfig

      resetPending()
      baseDbRef.current = cloneObject(fetchedDb)
      setDb(fetchedDb)
      setDbFetchId((id) => id + 1)
      console.info('[useTuningQueue] Database refreshed successfully.')
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      console.error('[GetDbResponse] failed', message)
      setFlushError(message)
      throw e
    }
  }, [resetPending])

  const resetEq = useCallback(async (client: WebhmiClient, target: webhmi.EqTarget, indices?: number[], sceneMode?: webhmi.OutputSceneMode) => {
    if (options.authOk !== true) return

    try {
      const index = indices?.length ? indices : []
      await client.resetEq({ target, index, sceneMode })

      const pendingKey = getEqPendingKey(target, sceneMode)
      const pending = pendingRef.current.eq.get(pendingKey)
      if (pending) {
        pending.points.clear()
        if (pending.bypass === undefined) pendingRef.current.eq.delete(pendingKey)
      }
      if (!hasPending()) clearFlushTimer()

      if (baseDbRef.current) applyEqPointDefaults(baseDbRef.current, target, indices, sceneMode)

      updateDbDraft((currentDb) => applyEqPointDefaults(currentDb, target, indices, sceneMode))
      setFlushError('')
    } catch (e) {
      setFlushError(e instanceof Error ? e.message : String(e))
      throw e
    }
  }, [options.authOk, hasPending, clearFlushTimer, updateDbDraft])

  const resetEqPointToDefault = useCallback(
    async (client: WebhmiClient, target: webhmi.EqTarget, index: number, sceneMode?: webhmi.OutputSceneMode) => {
      if (options.authOk !== true) return

      const sourceDb = db ?? baseDbRef.current
      if (!sourceDb) return

      const point = getEqPointRefByTargetAndIndex(sourceDb, target, index, sceneMode)
      if (!point) return

      const patch: webhmi.IEqPointPatch = { index }
      if (typeof point.defaultType === 'number') patch.type = point.defaultType
      if (typeof point.defaultFreq === 'number') patch.freq = point.defaultFreq
      if (typeof point.defaultGain === 'number') patch.gain = point.defaultGain
      if (typeof point.defaultQ === 'number') patch.q = point.defaultQ
      if (Object.keys(patch).length <= 1) return

      try {
        await client.setEq({ eq: [{ target, sceneMode, point: [patch] }] })

        const pendingKey = getEqPendingKey(target, sceneMode)
        const pending = pendingRef.current.eq.get(pendingKey)
        if (pending) {
          pending.points.delete(index)
          if (pending.points.size === 0 && pending.bypass === undefined) pendingRef.current.eq.delete(pendingKey)
        }
        if (!hasPending()) clearFlushTimer()

        if (baseDbRef.current) applyEqPointPatch(baseDbRef.current, target, patch, sceneMode)

        updateDbDraft((currentDb) => applyEqPointPatch(currentDb, target, patch, sceneMode))
        setFlushError('')
      } catch (e) {
        setFlushError(e instanceof Error ? e.message : String(e))
        throw e
      }
    },
    [options.authOk, db, hasPending, clearFlushTimer, updateDbDraft],
  )

  const switchCurrentMode = useCallback(
    async (client: WebhmiClient, index: number) => {
      if (options.authOk !== true) return

      try {
        await client.switchCurrentMode({ currentModeIndex: index })
        await refreshDb(client)
      } catch (e) {
        setFlushError(e instanceof Error ? e.message : String(e))
        throw e
      }
    },
    [options.authOk, refreshDb],
  )

  const saveMode = useCallback(
    async (client: WebhmiClient, index: number) => {
      if (options.authOk !== true) return
      try {
        await client.saveMode({ currentModeIndex: index })
        setFlushError('')
      } catch (e) {
        setFlushError(e instanceof Error ? e.message : String(e))
        throw e
      }
    },
    [options.authOk],
  )

  const rescheduleUserFlush = useCallback((client: WebhmiClient) => {
    if (flushInFlightRef.current) {
      flushRequestedRef.current = true
      return
    }
    if (!hasPending()) return
    if (options.authOk !== true) return

    const now = Date.now()
    const burstStartAt = userBurstStartAtRef.current ?? now
    const lastChangeAt = userLastChangeAtRef.current ?? now
    const burstAgeMs = now - burstStartAt
    const sinceTxMs = lastTxAtRef.current == null ? Number.POSITIVE_INFINITY : now - lastTxAtRef.current

    if (burstAgeMs >= USER_THROTTLE_MS && sinceTxMs >= USER_THROTTLE_MS) {
      scheduleFlush(client, 0)
      return
    }

    const debounceDelay = Math.max(0, lastChangeAt + USER_DEBOUNCE_MS - now)
    scheduleFlush(client, debounceDelay)
  }, [hasPending, options.authOk, scheduleFlush])

  const markUserChange = useCallback((client: WebhmiClient) => {
    const now = Date.now()
    userLastChangeAtRef.current = now
    if (userBurstStartAtRef.current == null) userBurstStartAtRef.current = now
    rescheduleUserFlush(client)
  }, [rescheduleUserFlush])

  const flushNow = useCallback(async (client: WebhmiClient) => {
    if (!hasPending()) return
    if (options.authOk !== true) return

    if (flushInFlightRef.current) {
      flushRequestedRef.current = true
      return
    }

    flushInFlightRef.current = true
    setFlushing(true)

    let flushSucceeded = false
    let snapshot: PendingPatches | null = null

    const mergePendingAfterFailure = (sent: PendingPatches) => {
      const current = pendingRef.current
      const mergedEq = new Map<string, PendingEqTarget>()

      const mergeEqTarget = (base: PendingEqTarget | undefined, patch: PendingEqTarget | undefined): PendingEqTarget => {
        const basePoints = base?.points ?? new Map<number, webhmi.IEqPointPatch>()
        const patchPoints = patch?.points ?? new Map<number, webhmi.IEqPointPatch>()
        const points = new Map<number, webhmi.IEqPointPatch>()
        for (const [idx, pp] of basePoints.entries()) points.set(idx, pp)
        for (const [idx, pp] of patchPoints.entries()) {
          const prev = points.get(idx) ?? { index: idx }
          points.set(idx, mergePatch(prev, pp))
        }
        const out: PendingEqTarget = {
          target: patch?.target ?? base?.target ?? 0,
          sceneMode: patch?.sceneMode ?? base?.sceneMode,
          points,
        }
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

      if (p.system) ops.push(client.setSystem(p.system))
      if (p.music) ops.push(client.setMusic(p.music))
      if (p.mic) ops.push(client.setMic(p.mic))
      if (p.reverb) ops.push(client.setReverb(p.reverb))
      if (p.echo) ops.push(client.setEcho(p.echo))
      if (p.mainOutput) ops.push(client.setMainOutput(p.mainOutput))
      if (p.subOutput) ops.push(client.setSubOutput(p.subOutput))
      if (p.center) ops.push(client.setCenter(p.center))
      if (p.surround) ops.push(client.setSurround(p.surround))

      let sentEq: webhmi.IEqPatch[] = []
      if (p.eq.size > 0) {
        sentEq = buildEqPatchesFromPending(p.eq, baseDbRef.current)
        if (sentEq.length > 0) ops.push(client.setEq({ eq: sentEq }))
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
          const sceneMode = typeof eqPatch.sceneMode === 'number' ? eqPatch.sceneMode as webhmi.OutputSceneMode : undefined
          if (typeof eqPatch.bypass === 'boolean') applyEqBypassPatch(baseDb, eqPatch.target as webhmi.EqTarget, eqPatch.bypass, sceneMode)
          for (const pointPatch of eqPatch.point ?? []) {
            applyEqPointPatch(baseDb, eqPatch.target as webhmi.EqTarget, pointPatch, sceneMode)
          }
        }
      }

      flushRetryDelayRef.current = 0
      setFlushError('')
    } catch (e) {
      if (snapshot) mergePendingAfterFailure(snapshot)
      const message = e instanceof Error ? e.message : String(e)
      console.warn('[Flush] failed:', message)
      setFlushError(message)

      const next = flushRetryDelayRef.current ? Math.min(flushRetryDelayRef.current * 2, 10_000) : 500
      flushRetryDelayRef.current = next
      scheduleFlush(client, next)
    } finally {
      setFlushing(false)
      flushInFlightRef.current = false
      if (flushSucceeded && (flushRequestedRef.current || hasPending())) rescheduleUserFlush(client)
    }
  }, [hasPending, options.authOk, clearFlushTimer, rescheduleUserFlush, scheduleFlush])

  useEffect(() => {
    flushNowRef.current = flushNow
  }, [flushNow])

  // Queue Param modifications
  const queueSystem = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetSystemRequest) => {
      pendingRef.current.system = mergePatch(pendingRef.current.system, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.system = applySectionPatch(currentDb.db.system, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueMusic = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetMusicRequest) => {
      pendingRef.current.music = mergePatch(pendingRef.current.music, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.music = applySectionPatch(currentDb.db.music, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueMic = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetMicRequest) => {
      pendingRef.current.mic = mergePatch(pendingRef.current.mic, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.mic = applySectionPatch(currentDb.db.mic, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueReverb = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetReverbRequest) => {
      pendingRef.current.reverb = mergePatch(pendingRef.current.reverb, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.reverb = applySectionPatch(currentDb.db.reverb, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueEcho = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetEchoRequest) => {
      pendingRef.current.echo = mergePatch(pendingRef.current.echo, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.echo = applySectionPatch(currentDb.db.echo, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueMainOutput = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetMainOutputRequest) => {
      pendingRef.current.mainOutput = mergePatch(pendingRef.current.mainOutput, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.mainOutput = applySectionPatch(currentDb.db.mainOutput, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueSubOutput = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetSubOutputRequest) => {
      pendingRef.current.subOutput = mergePatch(pendingRef.current.subOutput, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.subOutput = applySectionPatch(currentDb.db.subOutput, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueCenter = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetCenterRequest) => {
      pendingRef.current.center = mergePatch(pendingRef.current.center, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.center = applySectionPatch(currentDb.db.center, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueSurround = useCallback(
    (client: WebhmiClient, patch: webhmi.ISetSurroundRequest) => {
      pendingRef.current.surround = mergePatch(pendingRef.current.surround, patch)
      updateDbDraft((currentDb) => {
        if (currentDb.db) currentDb.db.surround = applySectionPatch(currentDb.db.surround, patch)
        return currentDb
      })
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueEqBypass = useCallback(
    (client: WebhmiClient, target: webhmi.EqTarget, bypass: boolean, sceneMode?: webhmi.OutputSceneMode) => {
      const key = getEqPendingKey(target, sceneMode)
      const entry: PendingEqTarget = pendingRef.current.eq.get(key) ?? { target, sceneMode, points: new Map() }
      entry.bypass = bypass
      pendingRef.current.eq.set(key, entry)

      updateDbDraft((currentDb) => applyEqBypassPatch(currentDb, target, bypass, sceneMode))
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  const queueEqPoint = useCallback(
    (
      client: WebhmiClient,
      target: webhmi.EqTarget,
      patch: webhmi.IEqPointPatch,
      sceneMode?: webhmi.OutputSceneMode,
      queueOptions: QueueEqPointOptions = {},
    ) => {
      if (typeof patch.index !== 'number') throw new Error('EqPointPatch.index is required')

      const key = getEqPendingKey(target, sceneMode)
      const entry = pendingRef.current.eq.get(key) ?? { target, sceneMode, points: new Map() }
      const prev = entry.points.get(patch.index) ?? { index: patch.index }
      entry.points.set(patch.index, mergePatch(prev, patch))
      pendingRef.current.eq.set(key, entry)

      if (queueOptions.syncDraft !== false) {
        updateDbDraft((currentDb) => applyEqPointPatch(currentDb, target, patch, sceneMode))
      }
      setFlushError('')
      markUserChange(client)
    },
    [markUserChange, updateDbDraft],
  )

  return {
    db,
    dbFetchId,
    flushing,
    flushError,
    resetPending,
    clearDb,
    updateDbDraft,
    refreshDb,
    resetEq,
    resetEqPointToDefault,
    switchCurrentMode,
    saveMode,
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
  }
}
