import {
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  FilterPoint,
  FrequencyResponseCurve,
  FrequencyResponseGraph,
  PointerTracker,
  type FilterChangeEvent,
  type FilterType,
  type GraphFilter,
} from 'dsssp'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import { FilterCard } from '../components'
import scale from '../configs/scale'
import theme from '../configs/theme'

import styles from './DemoMode.module.css'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { webhmi } from '@/device/proto/generated/webhmi'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'

type PanelKey =
  | 'music'
  | 'mica'
  | 'reverb'
  | 'echo'
  | 'mainoutput'
  | 'suboutput'
  | 'center'
  | 'surround'

type PanelDef = {
  key: PanelKey
  label: string
  target: webhmi.EqTarget
  getEq: (db: webhmi.IGetDbResponse | null) => webhmi.IEq | null
}

type PanelState = {
  filters: GraphFilter[]
  pointIndexByUiIndex: number[]
  allowedTypesByUiIndex: Array<FilterType[] | null>
}

const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps

const panelStateEqual = (a: PanelState, b: PanelState) => {
  if (a.pointIndexByUiIndex.length !== b.pointIndexByUiIndex.length) return false
  for (let i = 0; i < a.pointIndexByUiIndex.length; i++) {
    if (a.pointIndexByUiIndex[i] !== b.pointIndexByUiIndex[i]) return false
  }

  if (a.filters.length !== b.filters.length) return false
  for (let i = 0; i < a.filters.length; i++) {
    const fa = a.filters[i]
    const fb = b.filters[i]
    if (fa.type !== fb.type) return false
    if (!nearlyEqual(fa.freq, fb.freq)) return false
    if (!nearlyEqual(fa.gain, fb.gain)) return false
    if (!nearlyEqual(fa.q, fb.q)) return false
  }

  if (a.allowedTypesByUiIndex.length !== b.allowedTypesByUiIndex.length) return false
  for (let i = 0; i < a.allowedTypesByUiIndex.length; i++) {
    const aa = a.allowedTypesByUiIndex[i]
    const bb = b.allowedTypesByUiIndex[i]
    if (aa == null && bb == null) continue
    if (aa == null || bb == null) return false
    if (aa.length !== bb.length) return false
    for (let j = 0; j < aa.length; j++) {
      if (aa[j] !== bb[j]) return false
    }
  }

  return true
}

function mapFilterTypeToGraphType(type: webhmi.FilterType | null | undefined): GraphFilter['type'] {
  switch (type) {
    case webhmi.FilterType.Peak:
      return 'PEAK'
    case webhmi.FilterType.LowShelf:
      return 'LOWSHELF2'
    case webhmi.FilterType.HighShelf:
      return 'HIGHSHELF2'
    case webhmi.FilterType.LowPass:
      return 'LOWPASS2'
    case webhmi.FilterType.HighPass:
      return 'HIGHPASS2'
    case webhmi.FilterType.BandPass:
      return 'BANDPASS'
    case webhmi.FilterType.Notch:
      return 'NOTCH'
    default:
      return 'PEAK'
  }
}

function mapGraphTypeToFilterType(type: GraphFilter['type']): webhmi.FilterType {
  switch (type) {
    case 'PEAK':
      return webhmi.FilterType.Peak
    case 'LOWSHELF1':
    case 'LOWSHELF2':
      return webhmi.FilterType.LowShelf
    case 'HIGHSHELF1':
    case 'HIGHSHELF2':
      return webhmi.FilterType.HighShelf
    case 'LOWPASS1':
    case 'LOWPASS2':
      return webhmi.FilterType.LowPass
    case 'HIGHPASS1':
    case 'HIGHPASS2':
      return webhmi.FilterType.HighPass
    case 'BANDPASS':
      return webhmi.FilterType.BandPass
    case 'NOTCH':
      return webhmi.FilterType.Notch
    case 'BYPASS':
      return webhmi.FilterType.Peak
    default:
      return webhmi.FilterType.Peak
  }
}

function buildPanelStateFromEq(eq: webhmi.IEq | null): PanelState {
  const points = eq?.point ?? []
  const sorted = [...points].sort((a, b) => (Number(a.index ?? 0) || 0) - (Number(b.index ?? 0) || 0))

  const filters: GraphFilter[] = []
  const pointIndexByUiIndex: number[] = []
  const allowedTypesByUiIndex: Array<FilterType[] | null> = []

  const toUniqueGraphTypes = (types: Array<webhmi.FilterType | null | undefined> | null | undefined) => {
    const out: FilterType[] = []
    for (const t of types ?? []) {
      const mapped = mapFilterTypeToGraphType(t)
      if (!out.includes(mapped)) out.push(mapped)
    }
    return out
  }

  const allCount = sorted.length
  const highPassList = toUniqueGraphTypes(eq?.highPassTypeList)
  const midList = toUniqueGraphTypes(eq?.typeList)
  const lowPassList = toUniqueGraphTypes(eq?.lowPassTypeList)

  for (let uiIndex = 0; uiIndex < sorted.length; uiIndex++) {
    const p = sorted[uiIndex] ?? {}
    const pointIndex = typeof p.index === 'number' ? p.index : uiIndex
    pointIndexByUiIndex.push(pointIndex)

    const graphType = mapFilterTypeToGraphType(p.type)
    filters.push({
      type: graphType,
      freq: typeof p.freq === 'number' ? p.freq : 1000,
      gain: typeof p.gain === 'number' ? p.gain : 0,
      q: typeof p.q === 'number' ? p.q : 0.7,
    })

    let allowed: FilterType[] | null = null
    if (allCount <= 1) {
      allowed = [...highPassList, ...midList, ...lowPassList]
    } else if (uiIndex === 0) {
      allowed = highPassList.length ? highPassList : midList
    } else if (uiIndex === allCount - 1) {
      allowed = lowPassList.length ? lowPassList : midList
    } else {
      allowed = midList.length ? midList : [...highPassList, ...lowPassList]
    }

    if (allowed.length === 0) {
      allowedTypesByUiIndex.push(null)
    } else {
      allowedTypesByUiIndex.push(allowed.includes(graphType) ? allowed : [graphType, ...allowed])
    }
  }

  return { filters, pointIndexByUiIndex, allowedTypesByUiIndex }
}

type DspPanelProps = {
  powered: boolean
  bypass: boolean
  filters: GraphFilter[]
  allowedTypesByUiIndex: Array<FilterType[] | null>
  activeIndex: number
  dragging: boolean
  handleFilterChange: (filterEvent: FilterChangeEvent) => void
  handleMouseEnter: ({ index }: { index: number }) => void
  handleMouseLeave: () => void
  setDragging: (dragging: boolean) => void
  onReset: () => void
  onBypassChange: (bypass: boolean) => void
}

function DspPanel({
  powered,
  bypass,
  filters,
  allowedTypesByUiIndex,
  activeIndex,
  dragging,
  handleFilterChange,
  handleMouseEnter,
  handleMouseLeave,
  setDragging,
  onReset,
  onBypassChange,
}: DspPanelProps) {
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const [graphWidth, setGraphWidth] = useState(0)

  useEffect(() => {
    const element = graphContainerRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setGraphWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between pb-3">
          <Button variant="secondary" onClick={onReset}>
            Reset
          </Button>
          <Toggle aria-label="Bypass" variant="outline" pressed={bypass} onPressedChange={onBypassChange}>
            Bypass
          </Toggle>
        </div>
        <div ref={graphContainerRef} className="shadow-sm shadow-black relative w-full">
          {graphWidth > 0 && (
            <FrequencyResponseGraph width={graphWidth} height={360} theme={theme} scale={scale}>
              {powered ? (
                <>
                  {filters.map((filter, index) => (
                    <Fragment key={index}>
                      <FilterGradient fill={true} index={index} filter={filter} id={`filter-${index}`} />

                      <FilterCurve
                        showPin
                        index={index}
                        filter={filter}
                        active={activeIndex === index}
                        gradientId={`filter-${index}`}
                      />
                    </Fragment>
                  ))}
                  <CompositeCurve filters={filters} />
                  {filters.map((filter, index) => (
                    <FilterPoint
                      key={index}
                      index={index}
                      filter={filter}
                      active={activeIndex === index}
                      onDrag={setDragging}
                      onEnter={handleMouseEnter}
                      onLeave={handleMouseLeave}
                      onChange={handleFilterChange}
                    />
                  ))}
                  {!dragging && <PointerTracker />}
                </>
              ) : (
                <FrequencyResponseCurve dotted magnitudes={[]} color={tailwindColors.slate[500]} />
              )}
            </FrequencyResponseGraph>
          )}

          <div className={styles.glareOverlay}></div>
        </div>

        <div className="flex gap-1 w-full pt-2">
          {filters.map((filter, index) => (
            <FilterCard
              key={index}
              index={index}
              filter={filter}
              allowedTypes={allowedTypesByUiIndex[index] ?? undefined}
              disabled={!powered}
              active={activeIndex === index}
              onLeave={handleMouseLeave}
              onEnter={handleMouseEnter}
              onChange={handleFilterChange}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function DeviceDemo() {
  const { state, actions } = useDeviceSessionContext()

  const panels: PanelDef[] = useMemo(
    () => [
      { key: 'music', label: 'Music', target: webhmi.EqTarget.MUSIC, getEq: (db) => db?.db?.music?.eq ?? null },
      { key: 'mica', label: 'Mic', target: webhmi.EqTarget.MIC_A, getEq: (db) => db?.db?.mic?.micAEq?.eq ?? null },
      { key: 'reverb', label: 'Reverb', target: webhmi.EqTarget.REVERB, getEq: (db) => db?.db?.reverb?.eq ?? null },
      { key: 'echo', label: 'Echo', target: webhmi.EqTarget.ECHO, getEq: (db) => db?.db?.echo?.eq ?? null },
      {
        key: 'mainoutput',
        label: 'Main Output',
        target: webhmi.EqTarget.MAIN_OUTPUT,
        getEq: (db) => db?.db?.mainOutput?.eq ?? null,
      },
      {
        key: 'suboutput',
        label: 'Sub Output',
        target: webhmi.EqTarget.SUB_OUTPUT,
        getEq: (db) => db?.db?.subOutput?.eq ?? null,
      },
      { key: 'center', label: 'Center', target: webhmi.EqTarget.CENTER, getEq: (db) => db?.db?.center?.eq ?? null },
      {
        key: 'surround',
        label: 'Surround',
        target: webhmi.EqTarget.SURROUND,
        getEq: (db) => db?.db?.surround?.eq ?? null,
      },
    ],
    [],
  )

  const panelByKey = useMemo(() => Object.fromEntries(panels.map((p) => [p.key, p])) as Record<PanelKey, PanelDef>, [panels])

  const [dragging, setDragging] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)
  const [panelStateByKey, setPanelStateByKey] = useState<Record<PanelKey, PanelState>>(() => {
    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) out[panel.key] = { filters: [], pointIndexByUiIndex: [], allowedTypesByUiIndex: [] }
    return out
  })

  const panelStateByKeyRef = useRef(panelStateByKey)
  useEffect(() => {
    panelStateByKeyRef.current = panelStateByKey
  }, [panelStateByKey])

  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) {
      const eq = panel.getEq(state.db)
      out[panel.key] = buildPanelStateFromEq(eq)
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
  }, [panels, state.dbFetchId])

  const handleMouseLeave = () => {
    if (!dragging) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!dragging) setActiveIndex(index)
  }

  const uiRafIdRef = useRef<number | null>(null)
  const pendingUiPatchesRef = useRef<Map<PanelKey, Map<number, Partial<GraphFilter>>>>(new Map())

  const graphFilterEqual = (a: GraphFilter, b: GraphFilter) =>
    a.type === b.type && nearlyEqual(a.freq, b.freq) && nearlyEqual(a.gain, b.gain) && nearlyEqual(a.q, b.q)

  const applyUiPatches = useCallback((patchesByKey: Map<PanelKey, Map<number, Partial<GraphFilter>>>) => {
    if (patchesByKey.size === 0) return
    setPanelStateByKey((prev) => {
      let changed = false
      const next = { ...prev }

      for (const [key, patchesByIndex] of patchesByKey.entries()) {
        if (patchesByIndex.size === 0) continue
        let keyChanged = false
        const current = next[key] ?? { filters: [], pointIndexByUiIndex: [] }
        const nextFilters = [...current.filters]

        for (const [uiIndex, patch] of patchesByIndex.entries()) {
          const existing = nextFilters[uiIndex]
          if (!existing) {
            nextFilters[uiIndex] = patch as GraphFilter
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
    (key: PanelKey, filterEvent: FilterChangeEvent) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const { index: uiIndex, ended, ...filter } = filterEvent

      if (ended) {
        const pendingForKey = pendingUiPatchesRef.current.get(key)
        if (pendingForKey) {
          pendingForKey.delete(uiIndex)
          if (pendingForKey.size === 0) pendingUiPatchesRef.current.delete(key)
        }

        const patches = new Map<PanelKey, Map<number, Partial<GraphFilter>>>()
        patches.set(key, new Map([[uiIndex, filter]]))
        applyUiPatches(patches)
      } else {
        const byIndex = pendingUiPatchesRef.current.get(key) ?? new Map<number, Partial<GraphFilter>>()
        byIndex.set(uiIndex, filter)
        pendingUiPatchesRef.current.set(key, byIndex)
        scheduleUiFlush()
      }

      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const filterType = mapGraphTypeToFilterType(filter.type)
      const gain = filter.type === 'BYPASS' ? 0 : filter.gain
      const q = filter.type === 'BYPASS' ? 1 : filter.q

      actionsRef.current.queueEqPoint(def.target, {
        index: deviceIndex,
        type: filterType,
        freq: Math.max(1, Math.round(filter.freq)),
        gain,
        q,
      })
    },
    [applyUiPatches, panelByKey, scheduleUiFlush],
  )

  const handleFilterChangeByKey = useMemo(
    () =>
      ({
        music: (e: FilterChangeEvent) => handleFilterChangeForKey('music', e),
        mica: (e: FilterChangeEvent) => handleFilterChangeForKey('mica', e),
        reverb: (e: FilterChangeEvent) => handleFilterChangeForKey('reverb', e),
        echo: (e: FilterChangeEvent) => handleFilterChangeForKey('echo', e),
        mainoutput: (e: FilterChangeEvent) => handleFilterChangeForKey('mainoutput', e),
        suboutput: (e: FilterChangeEvent) => handleFilterChangeForKey('suboutput', e),
        center: (e: FilterChangeEvent) => handleFilterChangeForKey('center', e),
        surround: (e: FilterChangeEvent) => handleFilterChangeForKey('surround', e),
      }) satisfies Record<PanelKey, (e: FilterChangeEvent) => void>,
    [handleFilterChangeForKey],
  )

  const getPanelPower = (key: PanelKey) => {
    const eq = panelByKey[key]?.getEq(state.db)
    if (!eq) return { powered: false, bypass: false }
    const bypass = !!eq.bypass
    return { powered: !bypass, bypass }
  }

  return (
    <div className="text-white text-sans min-h-screen flex flex-col items-center">
      <div className="max-w-[840px] pt-1 flex flex-col gap-1">
        <Tabs defaultValue="music">
          <TabsList>
            <TabsTrigger value="music">Music</TabsTrigger>
            <TabsTrigger value="mic">Mic</TabsTrigger>
            <TabsTrigger value="reverb">Reverb</TabsTrigger>
            <TabsTrigger value="echo">Echo</TabsTrigger>
            <TabsTrigger value="mainoutput">Main Output</TabsTrigger>
            <TabsTrigger value="suboutput">Sub Output</TabsTrigger>
            <TabsTrigger value="center">Center</TabsTrigger>
            <TabsTrigger value="surround">Surround</TabsTrigger>
          </TabsList>

          <TabsContent value="music">
            <DspPanel
              {...getPanelPower('music')}
              filters={panelStateByKey.music.filters}
              allowedTypesByUiIndex={panelStateByKey.music.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.music}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MUSIC, pressed)}
            />
          </TabsContent>

          <TabsContent value="mic">
            <DspPanel
              {...getPanelPower('mica')}
              filters={panelStateByKey.mica.filters}
              allowedTypesByUiIndex={panelStateByKey.mica.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.mica}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MIC_A, pressed)}
            />
          </TabsContent>

          <TabsContent value="reverb">
            <DspPanel
              {...getPanelPower('reverb')}
              filters={panelStateByKey.reverb.filters}
              allowedTypesByUiIndex={panelStateByKey.reverb.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.reverb}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.REVERB, pressed)}
            />
          </TabsContent>

          <TabsContent value="echo">
            <DspPanel
              {...getPanelPower('echo')}
              filters={panelStateByKey.echo.filters}
              allowedTypesByUiIndex={panelStateByKey.echo.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.echo}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.ECHO, pressed)}
            />
          </TabsContent>

          <TabsContent value="mainoutput">
            <DspPanel
              {...getPanelPower('mainoutput')}
              filters={panelStateByKey.mainoutput.filters}
              allowedTypesByUiIndex={panelStateByKey.mainoutput.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.mainoutput}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MAIN_OUTPUT, pressed)}
            />
          </TabsContent>

          <TabsContent value="suboutput">
            <DspPanel
              {...getPanelPower('suboutput')}
              filters={panelStateByKey.suboutput.filters}
              allowedTypesByUiIndex={panelStateByKey.suboutput.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.suboutput}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SUB_OUTPUT, pressed)}
            />
          </TabsContent>

          <TabsContent value="center">
            <DspPanel
              {...getPanelPower('center')}
              filters={panelStateByKey.center.filters}
              allowedTypesByUiIndex={panelStateByKey.center.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.center}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.CENTER, pressed)}
            />
          </TabsContent>

          <TabsContent value="surround">
            <DspPanel
              {...getPanelPower('surround')}
              filters={panelStateByKey.surround.filters}
              allowedTypesByUiIndex={panelStateByKey.surround.allowedTypesByUiIndex}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChangeByKey.surround}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
              onReset={() => void actions.refreshDb()}
              onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SURROUND, pressed)}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default DeviceDemo
