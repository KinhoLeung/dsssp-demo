import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  buildPanelStateFromEq,
  isFixedQFilterType,
  mapGraphTypeToFilterType,
  nearlyEqual,
  panelStateEqual,
  type PanelDef,
  type PanelKey,
  type PanelState,
} from './dspUtils'
import { getSceneModeFromConfig } from './useOutputScene'

import type { webhmi } from '@/device/proto/generated/webhmi'

type TuningActions = {
  queueEqPoint: (target: webhmi.EqTarget, patch: webhmi.IEqPointPatch, sceneMode?: webhmi.OutputSceneMode) => void
  resetEqPointToDefault: (target: webhmi.EqTarget, index: number, sceneMode?: webhmi.OutputSceneMode) => Promise<unknown>
}

const isOutputPanelKey = (key: PanelKey) => key === 'mainoutput' || key === 'suboutput' || key === 'center' || key === 'surround'

const createEmptyPanelStateByKey = (panels: PanelDef[]) => {
  const out = {} as Record<PanelKey, PanelState>
  for (const panel of panels) out[panel.key] = { filters: [], pointIndexByUiIndex: [], allowedTypesByUiIndex: [] }
  return out
}

export function useEqPanelState(options: {
  panels: PanelDef[]
  panelByKey: Record<PanelKey, PanelDef>
  db: webhmi.IDeviceConfig | null
  dbFetchId: number
  actions: TuningActions
}) {
  const { panels, panelByKey, db, dbFetchId, actions } = options

  const [dragging, setDraggingState] = useState(false)
  const isDraggingRef = useRef(false)
  const setDragging = useCallback((dragging: boolean) => {
    isDraggingRef.current = dragging
    setDraggingState(dragging)
  }, [])

  const [activeIndex, setActiveIndexState] = useState<number>(0)
  const activeIndexRef = useRef(0)
  const setActiveIndex = useCallback((index: number) => {
    if (activeIndexRef.current === index) return
    activeIndexRef.current = index
    setActiveIndexState(index)
  }, [])

  const [panelStateByKey, setPanelStateByKey] = useState<Record<PanelKey, PanelState>>(() => createEmptyPanelStateByKey(panels))
  const panelStateByKeyRef = useRef(panelStateByKey)
  useEffect(() => {
    panelStateByKeyRef.current = panelStateByKey
  }, [panelStateByKey])

  const dbRef = useRef(db)
  useEffect(() => {
    dbRef.current = db
  }, [db])

  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (isDraggingRef.current) return

    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) {
      out[panel.key] = buildPanelStateFromEq(panel.getEq(db))
    }
    setPanelStateByKey((prev) => {
      let changed = false
      const next = { ...prev }
      for (const panel of panels) {
        const key = panel.key
        const desired = out[key]
        const existing = prev[key]
        if (!existing || !panelStateEqual(existing, desired)) {
          next[key] = desired
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [panels, dbFetchId, db])

  const handleMouseLeave = useCallback(() => {
    if (!isDraggingRef.current) setActiveIndex(-1)
  }, [setActiveIndex])

  const handleMouseEnter = useCallback(({ index }: { index: number }) => {
    if (!isDraggingRef.current) setActiveIndex(index)
  }, [setActiveIndex])

  const uiRafIdRef = useRef<number | null>(null)
  const pendingUiPatchesRef = useRef<Map<PanelKey, Map<number, Partial<any>>>>(new Map())

  const graphFilterEqual = (a: any, b: any) =>
    a.type === b.type && nearlyEqual(a.freq, b.freq) && nearlyEqual(a.gain, b.gain) && nearlyEqual(a.q, b.q)

  const applyUiPatches = useCallback((patchesByKey: Map<PanelKey, Map<number, Partial<any>>>) => {
    if (patchesByKey.size === 0) return
    setPanelStateByKey((prev) => {
      let changed = false
      const next = { ...prev }

      for (const [key, patchesByIndex] of patchesByKey.entries()) {
        if (patchesByIndex.size === 0) continue
        let keyChanged = false
        const current = next[key] ?? { filters: [], pointIndexByUiIndex: [], allowedTypesByUiIndex: [] }
        const nextFilters = [...current.filters]

        for (const [uiIndex, patch] of patchesByIndex.entries()) {
          const existing = nextFilters[uiIndex]
          if (!existing) {
            nextFilters[uiIndex] = patch as any
            keyChanged = true
            continue
          }
          const merged = { ...existing, ...patch }
          if (!graphFilterEqual(existing, merged)) {
            nextFilters[uiIndex] = merged
            keyChanged = true
          }
        }

        if (keyChanged) {
          next[key] = { ...current, filters: nextFilters }
          changed = true
        }
      }

      return changed ? next : prev
    })
  }, [])

  const scheduleUiFlush = useCallback(() => {
    if (uiRafIdRef.current != null) return
    uiRafIdRef.current = window.requestAnimationFrame(() => {
      uiRafIdRef.current = null
      const pending = pendingUiPatchesRef.current
      pendingUiPatchesRef.current = new Map()
      applyUiPatches(pending)
    })
  }, [applyUiPatches])

  useEffect(() => {
    return () => {
      if (uiRafIdRef.current != null) window.cancelAnimationFrame(uiRafIdRef.current)
    }
  }, [])

  const handleFilterChangeForKey = useCallback(
    (key: PanelKey, filterEvent: any) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const { index: uiIndex, ended, ...filterEventFilter } = filterEvent
      const existingFilter = stateForPanel.filters[uiIndex]
      const filter = isFixedQFilterType(filterEventFilter.type) && existingFilter
        ? { ...filterEventFilter, q: existingFilter.q }
        : filterEventFilter

      if (!ended) {
        setActiveIndex(uiIndex)
        setDragging(true)
      } else {
        setDragging(false)
      }

      const jointDebug = dbRef.current?.db?.mic?.micEqJointDebugging
      const otherKey = (jointDebug && (key === 'mica' || key === 'micb')) ? (key === 'mica' ? 'micb' : 'mica') : null

      if (ended) {
        const pendingForKey = pendingUiPatchesRef.current.get(key)
        if (pendingForKey) {
          pendingForKey.delete(uiIndex)
          if (pendingForKey.size === 0) pendingUiPatchesRef.current.delete(key)
        }

        if (otherKey) {
          const pendingForOther = pendingUiPatchesRef.current.get(otherKey)
          if (pendingForOther) {
            pendingForOther.delete(uiIndex)
            if (pendingForOther.size === 0) pendingUiPatchesRef.current.delete(otherKey)
          }
        }

        const patches = new Map<PanelKey, Map<number, Partial<any>>>()
        patches.set(key, new Map([[uiIndex, filter]]))
        if (otherKey) patches.set(otherKey, new Map([[uiIndex, filter]]))
        applyUiPatches(patches)
      } else {
        const byIndex = pendingUiPatchesRef.current.get(key) ?? new Map<number, Partial<any>>()
        byIndex.set(uiIndex, filter)
        pendingUiPatchesRef.current.set(key, byIndex)

        if (otherKey) {
          const byIndexOther = pendingUiPatchesRef.current.get(otherKey) ?? new Map<number, Partial<any>>()
          byIndexOther.set(uiIndex, filter)
          pendingUiPatchesRef.current.set(otherKey, byIndexOther)
        }

        scheduleUiFlush()
      }

      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const filterType = mapGraphTypeToFilterType(filter.type)
      const gain = filter.type === 'BYPASS' ? 0 : filter.gain
      const q = filter.type === 'BYPASS' ? 1 : filter.q
      const freq = Math.max(1, Math.round(filter.freq))

      const sourceDb = dbRef.current
      if (sourceDb) {
        const currentEq = def.getEq(sourceDb)
        if (currentEq?.point) {
          const cp = currentEq.point.find((point) => point && point.index === deviceIndex)
          if (cp && cp.type === filterType && nearlyEqual(cp.freq ?? 0, freq) && nearlyEqual(cp.gain ?? 0, gain) && nearlyEqual(cp.q ?? 0, q)) {
            return
          }
        }
      }

      const pointPatch = {
        index: deviceIndex,
        type: filterType,
        freq,
        gain,
        q,
      }
      const sceneMode = isOutputPanelKey(key) ? getSceneModeFromConfig(dbRef.current) : undefined
      actionsRef.current.queueEqPoint(def.target, pointPatch, sceneMode)

      if (jointDebug && otherKey) {
        const otherPanel = panelByKey[otherKey]
        if (otherPanel) {
          actionsRef.current.queueEqPoint(otherPanel.target, pointPatch)
        }
      }
    },
    [applyUiPatches, panelByKey, scheduleUiFlush, setActiveIndex, setDragging],
  )

  const handlePointDoubleClickForKey = useCallback(
    (key: PanelKey, filterEvent: any) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const uiIndex = filterEvent.index
      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const sceneMode = isOutputPanelKey(key) ? getSceneModeFromConfig(dbRef.current) : undefined
      void actionsRef.current.resetEqPointToDefault(def.target, deviceIndex, sceneMode)

      const jointDebug = stateForPanel.pointIndexByUiIndex.length > 0 && dbRef.current?.db?.mic?.micEqJointDebugging
      if (jointDebug && (key === 'mica' || key === 'micb')) {
        const otherKey = key === 'mica' ? 'micb' : 'mica'
        const otherPanel = panelByKey[otherKey]
        if (otherPanel) {
          void actionsRef.current.resetEqPointToDefault(otherPanel.target, deviceIndex)
        }
      }
    },
    [panelByKey],
  )

  const handleFilterChangeByKey = useMemo(
    () =>
      ({
        music: (e: any) => handleFilterChangeForKey('music', e),
        mica: (e: any) => handleFilterChangeForKey('mica', e),
        micb: (e: any) => handleFilterChangeForKey('micb', e),
        reverb: (e: any) => handleFilterChangeForKey('reverb', e),
        echo: (e: any) => handleFilterChangeForKey('echo', e),
        mainoutput: (e: any) => handleFilterChangeForKey('mainoutput', e),
        suboutput: (e: any) => handleFilterChangeForKey('suboutput', e),
        center: (e: any) => handleFilterChangeForKey('center', e),
        surround: (e: any) => handleFilterChangeForKey('surround', e),
      }) satisfies Record<PanelKey, (e: any) => void>,
    [handleFilterChangeForKey],
  )

  const handlePointDoubleClickByKey = useMemo(
    () =>
      ({
        music: (e: any) => handlePointDoubleClickForKey('music', e),
        mica: (e: any) => handlePointDoubleClickForKey('mica', e),
        micb: (e: any) => handlePointDoubleClickForKey('micb', e),
        reverb: (e: any) => handlePointDoubleClickForKey('reverb', e),
        echo: (e: any) => handlePointDoubleClickForKey('echo', e),
        mainoutput: (e: any) => handlePointDoubleClickForKey('mainoutput', e),
        suboutput: (e: any) => handlePointDoubleClickForKey('suboutput', e),
        center: (e: any) => handlePointDoubleClickForKey('center', e),
        surround: (e: any) => handlePointDoubleClickForKey('surround', e),
      }) satisfies Record<PanelKey, (e: any) => void>,
    [handlePointDoubleClickForKey],
  )

  const getPanelPower = useCallback((key: PanelKey) => {
    const eq = panelByKey[key]?.getEq(db)
    if (!eq) return { powered: false, bypass: false }
    const bypass = !!eq.bypass
    return { powered: !bypass, bypass }
  }, [db, panelByKey])

  return {
    panelStateByKey,
    dragging,
    activeIndex,
    setDragging,
    handleMouseLeave,
    handleMouseEnter,
    handleFilterChangeByKey,
    handlePointDoubleClickByKey,
    getPanelPower,
  }
}
