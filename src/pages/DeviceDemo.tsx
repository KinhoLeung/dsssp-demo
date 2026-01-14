import {
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  FilterPoint,
  FrequencyResponseCurve,
  FrequencyResponseGraph,
  PointerTracker,
  type FilterChangeEvent,
  type GraphFilter,
} from 'dsssp'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
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

  for (let uiIndex = 0; uiIndex < sorted.length; uiIndex++) {
    const p = sorted[uiIndex] ?? {}
    const pointIndex = typeof p.index === 'number' ? p.index : uiIndex
    pointIndexByUiIndex.push(pointIndex)

    filters.push({
      type: mapFilterTypeToGraphType(p.type),
      freq: typeof p.freq === 'number' ? p.freq : 1000,
      gain: typeof p.gain === 'number' ? p.gain : 0,
      q: typeof p.q === 'number' ? p.q : 0.7,
    })
  }

  return { filters, pointIndexByUiIndex }
}

type DspPanelProps = {
  powered: boolean
  bypass: boolean
  filters: GraphFilter[]
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
    for (const panel of panels) out[panel.key] = { filters: [], pointIndexByUiIndex: [] }
    return out
  })

  useEffect(() => {
    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) {
      const eq = panel.getEq(state.db)
      out[panel.key] = buildPanelStateFromEq(eq)
    }
    setPanelStateByKey(out)
  }, [panels, state.db, state.dbFetchId])

  const handleMouseLeave = () => {
    if (!dragging) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!dragging) setActiveIndex(index)
  }

  const makeHandleFilterChange = (key: PanelKey) => {
    return (filterEvent: FilterChangeEvent) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKey[key]
      if (!def || !stateForPanel) return

      const { index: uiIndex, ended, ...filter } = filterEvent
      setPanelStateByKey((prev) => {
        const next: Record<PanelKey, PanelState> = { ...prev }
        const current = next[key] ?? { filters: [], pointIndexByUiIndex: [] }
        const nextFilters = [...current.filters]
        nextFilters[uiIndex] = { ...nextFilters[uiIndex], ...filter }
        next[key] = { ...current, filters: nextFilters }
        return next
      })

      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      const filterType = mapGraphTypeToFilterType(filter.type)
      const gain = filter.type === 'BYPASS' ? 0 : filter.gain
      const q = filter.type === 'BYPASS' ? 1 : filter.q

      actions.queueEqPoint(def.target, {
        index: deviceIndex,
        type: filterType,
        freq: Math.max(1, Math.round(filter.freq)),
        gain,
        q,
      })

      if (ended) {
        // The transport layer already debounces/merges; this keeps the UI responsive without extra logic here.
      }
    }
  }

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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('music')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('mica')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('reverb')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('echo')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('mainoutput')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('suboutput')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('center')}
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
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={makeHandleFilterChange('surround')}
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
