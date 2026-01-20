import {
  CompositeCurve,
  DRCCurve,
  DRCGraph,
  FilterCurve,
  FilterGradient,
  FilterIcon,
  FilterPoint,
  FrequencyResponseCurve,
  FrequencyResponseGraph,
  PointerTracker,
  type FilterChangeEvent,
  type FilterPointEvent,
  type FilterType,
  type GraphFilter,
} from 'dsssp'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import tailwindColors from 'tailwindcss/colors'

import { FilterCard } from '../components'
import parameterRanges, { type RangeConfig } from '../configs/parameterRanges'
import scale from '../configs/scale'
import theme, { getTheme } from '../configs/theme'

import styles from './DemoMode.module.css'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from '@/components/ui/number-field'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { webhmi } from '@/device/proto/generated/webhmi'
import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'
import { cn } from '@/lib/utils'

type PanelKey =
  | 'music'
  | 'mica'
  | 'micb'
  | 'reverb'
  | 'echo'
  | 'mainoutput'
  | 'suboutput'
  | 'center'
  | 'surround'

type MainTabKey = 'music' | 'mic' | 'reverb' | 'echo' | 'mainoutput' | 'suboutput' | 'center' | 'surround' | 'system'

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

type SelectOption = {
  value: string
  label: string
}

const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
const hasAny = (...values: unknown[]) => values.some((value) => hasNumber(value) || hasBoolean(value))

const INPUT_SELECT_OPTIONS: SelectOption[] = [
  { value: String(webhmi.InputSelect.BT), label: 'BT' },
  { value: String(webhmi.InputSelect.UDISK), label: 'UDISK' },
  { value: String(webhmi.InputSelect.SPDIF), label: 'SPDIF' },
  { value: String(webhmi.InputSelect.COA), label: 'COA' },
  { value: String(webhmi.InputSelect.USB_Audio), label: 'USB Audio' },
  { value: String(webhmi.InputSelect.Auto_Input), label: 'Auto Input' },
  { value: String(webhmi.InputSelect.Input1_BGM), label: 'Input1 BGM' },
  { value: String(webhmi.InputSelect.Input2_aux), label: 'Input2 Aux' },
]

const FBX_OPTIONS: SelectOption[] = [
  { value: String(webhmi.FbxMode.Off), label: 'Off' },
  { value: String(webhmi.FbxMode.Level1), label: 'Level 1' },
  { value: String(webhmi.FbxMode.Level2), label: 'Level 2' },
  { value: String(webhmi.FbxMode.Level3), label: 'Level 3' },
  { value: String(webhmi.FbxMode.Level4), label: 'Level 4' },
  { value: String(webhmi.FbxMode.Level5), label: 'Level 5' },
  { value: String(webhmi.FbxMode.Level6), label: 'Level 6' },
]

const {
  music: musicRanges,
  mic: micRanges,
  reverb: reverbRanges,
  echo: echoRanges,
  mainOutput: mainOutputRanges,
  subOutput: subOutputRanges,
  center: centerRanges,
  surround: surroundRanges,
} = parameterRanges

const defaultThresholdRange = micRanges.compressor.threshold

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
  const graphTypeByUiIndex = sorted.map((p) => mapFilterTypeToGraphType(p.type))
  const highPassSlot = graphTypeByUiIndex.findIndex((t) => t.includes('HIGHPASS'))
  const lowPassSlot = graphTypeByUiIndex.findIndex((t) => t.includes('LOWPASS'))
  const highPassSlotIndex = highPassSlot >= 0 ? highPassSlot : 0
  const lowPassSlotIndex = lowPassSlot >= 0 ? lowPassSlot : Math.max(0, allCount - 1)

  for (let uiIndex = 0; uiIndex < sorted.length; uiIndex++) {
    const p = sorted[uiIndex] ?? {}
    const pointIndex = typeof p.index === 'number' ? p.index : uiIndex
    pointIndexByUiIndex.push(pointIndex)

    const graphType = graphTypeByUiIndex[uiIndex] ?? mapFilterTypeToGraphType(p.type)
    filters.push({
      type: graphType,
      freq: typeof p.freq === 'number' ? p.freq : 1000,
      gain: typeof p.gain === 'number' ? p.gain : 0,
      q: typeof p.q === 'number' ? p.q : 0.7,
    })

    let allowed: FilterType[] | null = null
    if (allCount <= 1) {
      allowed = [...highPassList, ...midList, ...lowPassList]
    } else if (uiIndex === highPassSlotIndex) {
      allowed = highPassList.length ? highPassList : midList
    } else if (uiIndex === lowPassSlotIndex) {
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
  pointIndexByUiIndex: number[]
  activeIndex: number
  dragging: boolean
  headerExtra?: ReactNode
  handleFilterChange: (filterEvent: FilterChangeEvent) => void
  handlePointDoubleClick: (filterEvent: FilterPointEvent) => void
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
  pointIndexByUiIndex,
  activeIndex,
  dragging,
  headerExtra,
  handleFilterChange,
  handlePointDoubleClick,
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
      const nextWidth = Math.floor(element.clientWidth)
      setGraphWidth((prevWidth) => (prevWidth === nextWidth ? prevWidth : nextWidth))
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const responsiveTheme = useMemo(() => {
    const isMobile = graphWidth < 640 // Tailwind's sm breakpoint
    return getTheme({
      background: {
        label: { fontSize: isMobile ? 10 : 14 },
      },
    })
  }, [graphWidth])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 pb-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary">Reset</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset EQ Settings?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will restore all EQ settings for the current panel to their default values. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="justify-self-center">{headerExtra}</div>
          <Toggle aria-label="Bypass" variant="outline" pressed={bypass} onPressedChange={onBypassChange}>
            Bypass
          </Toggle>
        </div>
        <div ref={graphContainerRef} className="shadow-sm shadow-black relative w-full">
          {graphWidth > 0 && (
            <FrequencyResponseGraph
              width={graphWidth}
              height={360}
              theme={responsiveTheme}
              scale={scale}
            >
              {powered ? (
                <>
                  {filters.map((filter, index) => (
                    <Fragment key={index}>
                      {activeIndex === index && (
                        <>
                          <FilterGradient fill={true} index={index} filter={filter} id={`filter-${index}`} />
                          <FilterCurve
                            showPin
                            index={index}
                            filter={filter}
                            active
                            gradientId={`filter-${index}`}
                          />
                        </>
                      )}
                    </Fragment>
                  ))}
                  <CompositeCurve filters={filters} />
                  {filters.map((filter, index) => (
                    <FilterPoint
                      key={index}
                      index={index}
                      filter={filter}
                      active={activeIndex === index}
                      showIcon={filter.type.includes('LOWPASS') || filter.type.includes('HIGHPASS')}
                      label={
                        filter.type.includes('LOWPASS') || filter.type.includes('HIGHPASS')
                          ? ''
                          : String(pointIndexByUiIndex[index] ?? index)
                      }
                      labelColor="inherit"
                      zeroColor={
                        activeIndex === index ? theme.filters?.colors?.[index]?.active : theme.filters?.colors?.[index]?.point
                      }
                      zeroBackground={theme.filters?.colors?.[index]?.background}
                      onDrag={setDragging}
                      onEnter={handleMouseEnter}
                      onLeave={handleMouseLeave}
                      onDoubleClick={handlePointDoubleClick}
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

        {/* Desktop View: All filter cards in a row */}
        <div className="hidden sm:flex gap-1 w-full pt-2">
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

        {/* Mobile View: Tabbed filter cards */}
        <div className="sm:hidden pt-4">
          <Tabs
            value={String(activeIndex >= 0 ? activeIndex : 0)}
            onValueChange={(val) => handleMouseEnter({ index: Number(val) })}
          >
            <TabsList className="bg-transparent h-auto p-0 flex-wrap justify-start gap-2 mb-4 shrink-0 overflow-x-auto no-scrollbar">
              {filters.map((filter, i) => {
                const label = pointIndexByUiIndex[i] ?? i
                const isActive = activeIndex === i
                const color = theme.filters?.colors?.[i]?.active ?? 'var(--primary)'

                return (
                  <TabsTrigger
                    key={i}
                    value={String(i)}
                    className="w-10 h-10 rounded-xl p-0 transition-all duration-200 border-2 data-[state=active]:shadow-[0_0_12px_rgba(0,0,0,0.3)] bg-zinc-900/80"
                    style={{
                      borderColor: isActive ? color : 'rgba(39, 39, 42, 0.5)',
                      backgroundColor: isActive ? color : undefined,
                      color: isActive ? '#fff' : color,
                    }}
                  >
                    {filter.type.includes('HIGHPASS') ? (
                      <FilterIcon type="HIGHPASS1" size={20} color={isActive ? '#fff' : color} />
                    ) : filter.type.includes('LOWPASS') ? (
                      <FilterIcon type="LOWPASS1" size={20} color={isActive ? '#fff' : color} />
                    ) : (
                      <span className="font-medium text-sm">{label}</span>
                    )}
                  </TabsTrigger>
                )
              })}
            </TabsList>
            {filters.map((filter, index) => (
              <TabsContent key={index} value={String(index)} className="mt-0">
                <FilterCard
                  index={index}
                  filter={filter}
                  allowedTypes={allowedTypesByUiIndex[index] ?? undefined}
                  disabled={!powered}
                  active={true}
                  onLeave={handleMouseLeave}
                  onEnter={handleMouseEnter}
                  onChange={handleFilterChange}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}

type CompressorGraphProps = {
  threshold?: number | null
  ratio?: number | null
  attack?: number | null
  release?: number | null
  disabled?: boolean
  thresholdRange?: RangeConfig
}

function CompressorGraph({
  threshold,
  ratio,
  attack,
  release,
  disabled,
  thresholdRange = defaultThresholdRange,
}: CompressorGraphProps) {
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const [graphWidth, setGraphWidth] = useState(0)
  const { min: thresholdMin, max: thresholdMax } = thresholdRange

  const drcScale = useMemo(
    () => ({
      ...scale,
      minGain: thresholdMin,
      maxGain: thresholdMax,
      displayMinGain: thresholdMin,
      displayMaxGain: thresholdMax,
      dbSteps: 10,
      dbLabelSteps: 10,
    }),
    [thresholdMin, thresholdMax],
  )

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

  const resolvedThreshold = typeof threshold === 'number' ? threshold : 0
  const resolvedRatio = typeof ratio === 'number' ? ratio : 1
  const graphHeight = 160
  const wrapperClassName = `overflow-hidden rounded-md border border-muted/40 bg-muted/20${disabled ? ' opacity-50' : ''
    }`

  return (
    <div ref={graphContainerRef} className={wrapperClassName}>
      {graphWidth > 0 && (
        <DRCGraph width={graphWidth} height={graphHeight} theme={theme} scale={drcScale}>
          <DRCCurve
            threshold={resolvedThreshold}
            ratio={resolvedRatio}
            attack={typeof attack === 'number' ? attack : undefined}
            release={typeof release === 'number' ? release : undefined}
            inputMin={thresholdMin}
            inputMax={thresholdMax}
          />
        </DRCGraph>
      )}
    </div>
  )
}

type ParameterCardProps = {
  title?: string
  className?: string
  contentClassName?: string
  children: ReactNode
}

function ParameterCard({ title, className, contentClassName, children }: ParameterCardProps) {
  const hasTitle = !!title
  const contentClasses = [
    'grid gap-3 grid-cols-1',
    contentClassName,
    hasTitle ? '' : 'pt-6',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <Card className={className}>
      {hasTitle ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={contentClasses}>{children}</CardContent>
    </Card>
  )
}

type NumberControlProps = {
  label: string
  value?: number | null
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  onChange: (value: number) => void
}

function NumberControl({ label, value, step = 1, min, max, disabled, className, onChange }: NumberControlProps) {
  return (
    <NumberField
      value={value ?? undefined}
      onValueChange={(next) => {
        if (typeof next !== 'number' || Number.isNaN(next)) return
        onChange(next)
      }}
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      className={cn("gap-1", className)}
    >
      <NumberFieldLabel className="text-xs text-muted-foreground">{label}</NumberFieldLabel>
      <NumberFieldGroup>
        <NumberFieldDecrementTrigger />
        <NumberFieldInput className="text-sm tabular-nums" />
        <NumberFieldIncrementTrigger />
      </NumberFieldGroup>
    </NumberField>
  )
}

type ToggleGroupControlProps = {
  label: string
  value?: string
  options: SelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

function ToggleGroupControl({ label, value, options, disabled, onChange }: ToggleGroupControlProps) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next)
        }}
        disabled={disabled}
        className="flex flex-wrap justify-start"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

type ToggleControlProps = {
  label: string
  pressed?: boolean | null
  disabled?: boolean
  onChange: (pressed: boolean) => void
}

function ToggleControl({ label, pressed, disabled, onChange }: ToggleControlProps) {
  const isPressed = !!pressed
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Toggle
        aria-label={label}
        variant="outline"
        pressed={isPressed}
        onPressedChange={onChange}
        disabled={disabled}
      >
        {isPressed ? 'On' : 'Off'}
      </Toggle>
    </div>
  )
}

function DeviceDemo() {
  const { state, actions } = useDeviceSessionContext()
  const disconnect = actions.disconnect
  const didMountOnceRef = useRef(false)

  useEffect(() => {
    const shouldDisconnectOnCleanup = didMountOnceRef.current
    didMountOnceRef.current = true
    return () => {
      if (!shouldDisconnectOnCleanup) return
      void disconnect()
    }
  }, [disconnect])

  const panels: PanelDef[] = useMemo(
    () => [
      { key: 'music', label: 'Music', target: webhmi.EqTarget.MUSIC, getEq: (db) => db?.db?.music?.eq ?? null },
      { key: 'mica', label: 'Mic', target: webhmi.EqTarget.MIC_A, getEq: (db) => db?.db?.mic?.micAEq?.eq ?? null },
      { key: 'micb', label: 'Mic', target: webhmi.EqTarget.MIC_B, getEq: (db) => db?.db?.mic?.micBEq?.eq ?? null },
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

  const db = state.db?.db ?? null
  const baseDisabled = !db || state.authOk !== true
  const systemDb = db?.system ?? null
  const musicDb = db?.music ?? null
  const micDb = db?.mic ?? null
  const reverbDb = db?.reverb ?? null
  const echoDb = db?.echo ?? null
  const mainOutputDb = db?.mainOutput ?? null
  const subOutputDb = db?.subOutput ?? null
  const centerDb = db?.center ?? null
  const surroundDb = db?.surround ?? null
  const musicInputSelectValue = typeof musicDb?.inputSelect === 'number' ? String(musicDb.inputSelect) : undefined
  const micFbxValue = typeof micDb?.micFBX === 'number' ? String(micDb.micFBX) : undefined
  const systemModeValue = useMemo(() => {
    const index = systemDb?.currentModeIndex
    if (typeof index !== 'number') return undefined
    const modes = systemDb?.modeList ?? []
    if (index < 0 || index >= modes.length) return undefined
    return String(index)
  }, [systemDb?.currentModeIndex, systemDb?.modeList])
  const musicDisabled = baseDisabled || !musicDb
  const micDisabled = baseDisabled || !micDb
  const reverbDisabled = baseDisabled || !reverbDb
  const echoDisabled = baseDisabled || !echoDb
  const mainOutputDisabled = baseDisabled || !mainOutputDb
  const subOutputDisabled = baseDisabled || !subOutputDb
  const centerDisabled = baseDisabled || !centerDb
  const surroundDisabled = baseDisabled || !surroundDb
  const systemDisabled = baseDisabled || !systemDb

  const systemModeOptions = useMemo<SelectOption[]>(() => {
    const modes = systemDb?.modeList ?? []
    return modes.map((label, index) => ({ value: String(index), label }))
  }, [systemDb?.modeList])

  const [bleNameDraft, setBleNameDraft] = useState('')
  useEffect(() => {
    const next = systemDb?.bleName ?? ''
    setBleNameDraft((prev) => (prev === next ? prev : next))
  }, [systemDb?.bleName])

  const showMusicParamsCard = hasAny(
    musicDb?.inputGain,
    musicDb?.musicPitch,
    musicDb?.btGain,
    musicDb?.udiskGain,
    musicDb?.inputSelect,
    musicDb?.bass,
    musicDb?.mid,
    musicDb?.midFreq,
    musicDb?.treble,
  )
  const showMusicNoiseCard = !!musicDb?.noise && hasAny(musicDb.noise.gate, musicDb.noise.frameTime, musicDb.noise.atkTime, musicDb.noise.relTime)

  const showMicParamsCard = hasAny(
    micDb?.micAVolume,
    micDb?.micBVolume,
    micDb?.micEqJointDebugging,
    micDb?.micFBX,
    micDb?.bass,
    micDb?.mid,
    micDb?.midFreq,
    micDb?.treble,
  )
  const showMicNoiseCard = !!micDb?.noise && hasAny(micDb.noise.gate, micDb.noise.frameTime, micDb.noise.atkTime, micDb.noise.relTime)
  const showMicCompressorCard = !!micDb?.compressor && hasAny(
    micDb.compressor.threshold,
    micDb.compressor.ratio,
    micDb.compressor.attack,
    micDb.compressor.release,
    micDb.compressor.bypass,
  )

  const showReverbCard = hasAny(reverbDb?.reverbLevel, reverbDb?.micDirectLevel, reverbDb?.reverbPredelay, reverbDb?.reverbDecay)
  const showEchoCard = hasAny(
    echoDb?.echoLevel,
    echoDb?.micDirectLevel,
    echoDb?.echoPredelay,
    echoDb?.echoDelayTime,
    echoDb?.echoRepeat,
    echoDb?.echoRightPredelay,
    echoDb?.echoRightDelay,
  )

  const showMainOutputOutputCard =
    !!mainOutputDb?.output &&
    hasAny(
      mainOutputDb.output.leftChannelVolume,
      mainOutputDb.output.rightChannelVolume,
      mainOutputDb.output.leftDelay,
      mainOutputDb.output.rightDelay,
      mainOutputDb.output.leftMute,
      mainOutputDb.output.rightMute,
    )
  const showMainOutputMixerCard =
    !!mainOutputDb?.mixer &&
    hasAny(
      mainOutputDb.mixer.micDirectLevel,
      mainOutputDb.mixer.musicLevel,
      mainOutputDb.mixer.reverbLevel,
      mainOutputDb.mixer.echoLevel,
    )
  const showMainOutputCompressorCard =
    !!mainOutputDb?.compressor &&
    hasAny(
      mainOutputDb.compressor.threshold,
      mainOutputDb.compressor.ratio,
      mainOutputDb.compressor.attack,
      mainOutputDb.compressor.release,
      mainOutputDb.compressor.bypass,
    )

  const showSubOutputOutputCard =
    !!subOutputDb?.output && hasAny(subOutputDb.output.volume, subOutputDb.output.delay, subOutputDb.output.mute)
  const showSubOutputMixerCard =
    !!subOutputDb?.mixer &&
    hasAny(subOutputDb.mixer.micDirectLevel, subOutputDb.mixer.musicLevel, subOutputDb.mixer.reverbLevel, subOutputDb.mixer.echoLevel)
  const showSubOutputCompressorCard =
    !!subOutputDb?.compressor &&
    hasAny(
      subOutputDb.compressor.threshold,
      subOutputDb.compressor.ratio,
      subOutputDb.compressor.attack,
      subOutputDb.compressor.release,
      subOutputDb.compressor.bypass,
    )

  const showCenterOutputCard = !!centerDb?.output && hasAny(centerDb.output.volume, centerDb.output.delay, centerDb.output.mute)
  const showCenterMixerCard =
    !!centerDb?.mixer && hasAny(centerDb.mixer.micDirectLevel, centerDb.mixer.musicLevel, centerDb.mixer.reverbLevel, centerDb.mixer.echoLevel)
  const showCenterCompressorCard =
    !!centerDb?.compressor &&
    hasAny(
      centerDb.compressor.threshold,
      centerDb.compressor.ratio,
      centerDb.compressor.attack,
      centerDb.compressor.release,
      centerDb.compressor.bypass,
    )

  const showSurroundOutputCard =
    !!surroundDb?.output &&
    hasAny(
      surroundDb.output.leftChannelVolume,
      surroundDb.output.rightChannelVolume,
      surroundDb.output.leftDelay,
      surroundDb.output.rightDelay,
      surroundDb.output.leftMute,
      surroundDb.output.rightMute,
    )
  const showSurroundMixerCard =
    !!surroundDb?.mixer &&
    hasAny(surroundDb.mixer.micDirectLevel, surroundDb.mixer.musicLevel, surroundDb.mixer.reverbLevel, surroundDb.mixer.echoLevel)
  const showSurroundCompressorCard =
    !!surroundDb?.compressor &&
    hasAny(
      surroundDb.compressor.threshold,
      surroundDb.compressor.ratio,
      surroundDb.compressor.attack,
      surroundDb.compressor.release,
      surroundDb.compressor.bypass,
    )

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

      // Ensure active state and dragging state are maintained during any interaction (drag or right-click adjust)
      if (!ended) {
        setActiveIndex(uiIndex)
        setDragging(true)
      } else {
        setDragging(false)
      }

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
    [applyUiPatches, panelByKey, scheduleUiFlush, setActiveIndex, setDragging],
  )

  const handlePointDoubleClickForKey = useCallback(
    (key: PanelKey, filterEvent: FilterPointEvent) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const uiIndex = filterEvent.index
      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      void actionsRef.current.resetEqPointToDefault(def.target, deviceIndex)
    },
    [panelByKey],
  )

  const handleFilterChangeByKey = useMemo(
    () =>
      ({
        music: (e: FilterChangeEvent) => handleFilterChangeForKey('music', e),
        mica: (e: FilterChangeEvent) => handleFilterChangeForKey('mica', e),
        micb: (e: FilterChangeEvent) => handleFilterChangeForKey('micb', e),
        reverb: (e: FilterChangeEvent) => handleFilterChangeForKey('reverb', e),
        echo: (e: FilterChangeEvent) => handleFilterChangeForKey('echo', e),
        mainoutput: (e: FilterChangeEvent) => handleFilterChangeForKey('mainoutput', e),
        suboutput: (e: FilterChangeEvent) => handleFilterChangeForKey('suboutput', e),
        center: (e: FilterChangeEvent) => handleFilterChangeForKey('center', e),
        surround: (e: FilterChangeEvent) => handleFilterChangeForKey('surround', e),
      }) satisfies Record<PanelKey, (e: FilterChangeEvent) => void>,
    [handleFilterChangeForKey],
  )

  const handlePointDoubleClickByKey = useMemo(
    () =>
      ({
        music: (e: FilterPointEvent) => handlePointDoubleClickForKey('music', e),
        mica: (e: FilterPointEvent) => handlePointDoubleClickForKey('mica', e),
        micb: (e: FilterPointEvent) => handlePointDoubleClickForKey('micb', e),
        reverb: (e: FilterPointEvent) => handlePointDoubleClickForKey('reverb', e),
        echo: (e: FilterPointEvent) => handlePointDoubleClickForKey('echo', e),
        mainoutput: (e: FilterPointEvent) => handlePointDoubleClickForKey('mainoutput', e),
        suboutput: (e: FilterPointEvent) => handlePointDoubleClickForKey('suboutput', e),
        center: (e: FilterPointEvent) => handlePointDoubleClickForKey('center', e),
        surround: (e: FilterPointEvent) => handlePointDoubleClickForKey('surround', e),
      }) satisfies Record<PanelKey, (e: FilterPointEvent) => void>,
    [handlePointDoubleClickForKey],
  )

  const getPanelPower = (key: PanelKey) => {
    const eq = panelByKey[key]?.getEq(state.db)
    if (!eq) return { powered: false, bypass: false }
    const bypass = !!eq.bypass
    return { powered: !bypass, bypass }
  }

  type MicPanelKey = 'mica' | 'micb'
  const [micKey, setMicKey] = useState<MicPanelKey>('mica')
  const hasMicA = !!panelByKey.mica?.getEq(state.db)
  const hasMicB = !!panelByKey.micb?.getEq(state.db)
  const showMicSelector = hasMicA && hasMicB

  useEffect(() => {
    const desired: MicPanelKey = hasMicA ? 'mica' : hasMicB ? 'micb' : 'mica'
    if ((micKey === 'mica' && !hasMicA && hasMicB) || (micKey === 'micb' && !hasMicB && hasMicA)) {
      setMicKey(desired)
    }
    if (!hasMicA && !hasMicB && micKey !== 'mica') setMicKey('mica')
  }, [hasMicA, hasMicB, micKey])

  const availableTabs = useMemo<MainTabKey[]>(() => {
    const out: MainTabKey[] = []
    if (musicDb) out.push('music')
    if (micDb) out.push('mic')
    if (reverbDb) out.push('reverb')
    if (echoDb) out.push('echo')
    if (mainOutputDb) out.push('mainoutput')
    if (subOutputDb) out.push('suboutput')
    if (centerDb) out.push('center')
    if (surroundDb) out.push('surround')
    if (systemDb) out.push('system')
    return out
  }, [centerDb, echoDb, mainOutputDb, micDb, musicDb, reverbDb, subOutputDb, surroundDb, systemDb])

  const [activeTab, setActiveTab] = useState<MainTabKey>(() => {
    if (musicDb) return 'music'
    if (micDb) return 'mic'
    if (reverbDb) return 'reverb'
    if (echoDb) return 'echo'
    if (mainOutputDb) return 'mainoutput'
    if (subOutputDb) return 'suboutput'
    if (centerDb) return 'center'
    if (surroundDb) return 'surround'
    if (systemDb) return 'system'
    return 'music'
  })

  useEffect(() => {
    if (availableTabs.length === 0) return
    if (!availableTabs.includes(activeTab)) setActiveTab(availableTabs[0])
  }, [activeTab, availableTabs])

  return (
    <div className="text-white text-sans min-h-screen flex flex-col items-center">
      <div className="w-full max-w-[1200px] pt-1 flex flex-col gap-1">
        {systemDb && (
          <Card className="mb-2 bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-4 flex flex-wrap items-end gap-6 justify-center">
              <NumberControl
                label="Music Volume"
                value={systemDb.musicVolume ?? undefined}
                min={0}
                max={typeof systemDb.musicMaxVolume === 'number' ? systemDb.musicMaxVolume : undefined}
                disabled={systemDisabled}
                className="w-32"
                onChange={(value) => actions.queueSystem({ musicVolume: Math.round(value) })}
              />
              <NumberControl
                label="Mic Volume"
                value={systemDb.micVolume ?? undefined}
                min={0}
                max={typeof systemDb.micMaxVolume === 'number' ? systemDb.micMaxVolume : undefined}
                disabled={systemDisabled}
                className="w-32"
                onChange={(value) => actions.queueSystem({ micVolume: Math.round(value) })}
              />
              <NumberControl
                label="Effect Volume"
                value={systemDb.effectVolume ?? undefined}
                min={0}
                max={typeof systemDb.effectMaxVolume === 'number' ? systemDb.effectMaxVolume : undefined}
                disabled={systemDisabled}
                className="w-32"
                onChange={(value) => actions.queueSystem({ effectVolume: Math.round(value) })}
              />
              <div className="flex items-center h-[56px] pb-1">
                <ToggleControl
                  label="Mute"
                  pressed={systemDb.mute ?? undefined}
                  disabled={systemDisabled}
                  onChange={(pressed) => actions.queueSystem({ mute: pressed })}
                />
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const next = value as MainTabKey
            if (availableTabs.includes(next)) setActiveTab(next)
          }}
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 sm:justify-center">
            {musicDb && <TabsTrigger value="music">Music</TabsTrigger>}
            {micDb && <TabsTrigger value="mic">Mic</TabsTrigger>}
            {reverbDb && <TabsTrigger value="reverb">Reverb</TabsTrigger>}
            {echoDb && <TabsTrigger value="echo">Echo</TabsTrigger>}
            {mainOutputDb && <TabsTrigger value="mainoutput">Main Output</TabsTrigger>}
            {subOutputDb && <TabsTrigger value="suboutput">Sub Output</TabsTrigger>}
            {centerDb && <TabsTrigger value="center">Center</TabsTrigger>}
            {surroundDb && <TabsTrigger value="surround">Surround</TabsTrigger>}
            {systemDb && <TabsTrigger value="system">System</TabsTrigger>}
          </TabsList>

          {systemDb && (
            <TabsContent value="system">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <ParameterCard title="Bluetooth" contentClassName="sm:grid-cols-2">
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">BLE Name</Label>
                      <Label className="text-sm">{systemDb.bleName || '-'}</Label>
                    </div>
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">New BLE Name</Label>
                      <div className="flex gap-2">
                        <Input
                          value={bleNameDraft}
                          disabled={systemDisabled}
                          onChange={(e) => setBleNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key !== 'Enter') return
                            e.preventDefault()
                            const next = bleNameDraft.trim()
                            if (systemDisabled) return
                            if (!next) return
                            if (next === (systemDb.bleName ?? '')) return
                            actions.queueSystem({ bleName: next })
                            void actions.flushNow()
                          }}
                        />
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={
                            systemDisabled || !bleNameDraft.trim() || bleNameDraft.trim() === (systemDb.bleName ?? '')
                          }
                          onClick={() => {
                            const next = bleNameDraft.trim()
                            if (!next) return
                            if (next === (systemDb.bleName ?? '')) return
                            actions.queueSystem({ bleName: next })
                            void actions.flushNow()
                          }}
                        >
                          Modify
                        </Button>
                      </div>
                    </div>
                  </ParameterCard>

                  <ParameterCard title="System" contentClassName="sm:grid-cols-2">
                    <ToggleControl
                      label="Panel Lock"
                      pressed={systemDb.panelLock ?? undefined}
                      disabled={systemDisabled}
                      onChange={(pressed) => actions.queueSystem({ panelLock: pressed })}
                    />

                    {systemModeOptions.length > 0 && (
                      <div className="grid gap-1">
                        <Label className="text-xs text-muted-foreground">Mode</Label>
                        <Select
                          value={systemModeValue}
                          onValueChange={(value) => actions.queueSystem({ currentModeIndex: Number(value) })}
                          disabled={systemDisabled}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select mode" />
                          </SelectTrigger>
                          <SelectContent>
                            {systemModeOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </ParameterCard>

                  <ParameterCard title="Defaults" contentClassName="sm:grid-cols-2">
                    <ToggleControl
                      label="Use Default Volume"
                      pressed={systemDb.useDefaultVolume ?? undefined}
                      disabled={systemDisabled}
                      onChange={(pressed) => actions.queueSystem({ useDefaultVolume: pressed })}
                    />
                    <NumberControl
                      label="Music Default"
                      value={systemDb.musicDefaultVolume ?? undefined}
                      min={0}
                      max={typeof systemDb.musicMaxVolume === 'number' ? systemDb.musicMaxVolume : undefined}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ musicDefaultVolume: Math.round(value) })}
                    />
                    <NumberControl
                      label="Mic Default"
                      value={systemDb.micDefaultVolume ?? undefined}
                      min={0}
                      max={typeof systemDb.micMaxVolume === 'number' ? systemDb.micMaxVolume : undefined}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ micDefaultVolume: Math.round(value) })}
                    />
                    <NumberControl
                      label="Effect Default"
                      value={systemDb.effectDefaultVolume ?? undefined}
                      min={0}
                      max={typeof systemDb.effectMaxVolume === 'number' ? systemDb.effectMaxVolume : undefined}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ effectDefaultVolume: Math.round(value) })}
                    />
                  </ParameterCard>

                  <ParameterCard title="Limits" contentClassName="sm:grid-cols-2">
                    <NumberControl
                      label="Music Max"
                      value={systemDb.musicMaxVolume ?? undefined}
                      min={0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ musicMaxVolume: Math.round(value) })}
                    />
                    <NumberControl
                      label="Mic Max"
                      value={systemDb.micMaxVolume ?? undefined}
                      min={0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ micMaxVolume: Math.round(value) })}
                    />
                    <NumberControl
                      label="Effect Max"
                      value={systemDb.effectMaxVolume ?? undefined}
                      min={0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => actions.queueSystem({ effectMaxVolume: Math.round(value) })}
                    />
                  </ParameterCard>
                </div>
              </div>
            </TabsContent>
          )}

          {musicDb && (
            <TabsContent value="music">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('music')}
                  filters={panelStateByKey.music.filters}
                  allowedTypesByUiIndex={panelStateByKey.music.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.music.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.music}
                  handlePointDoubleClick={handlePointDoubleClickByKey.music}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.MUSIC)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MUSIC, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMusicParamsCard && (
                    <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
                      {hasNumber(musicDb?.inputGain) && (
                        <NumberControl
                          label="Input Gain"
                          value={musicDb?.inputGain ?? undefined}
                          {...musicRanges.inputGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ inputGain: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.musicPitch) && (
                        <NumberControl
                          label="Music Pitch"
                          value={musicDb?.musicPitch ?? undefined}
                          {...musicRanges.musicPitch}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ musicPitch: value })}
                        />
                      )}
                      {hasNumber(musicDb?.btGain) && (
                        <NumberControl
                          label="BT Gain"
                          value={musicDb?.btGain ?? undefined}
                          {...musicRanges.btGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ btGain: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.udiskGain) && (
                        <NumberControl
                          label="UDisk Gain"
                          value={musicDb?.udiskGain ?? undefined}
                          {...musicRanges.udiskGain}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ udiskGain: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.inputSelect) && (
                        <div className="sm:col-span-2 md:col-span-4">
                          <ToggleGroupControl
                            label="Input Select"
                            value={musicInputSelectValue}
                            options={INPUT_SELECT_OPTIONS}
                            disabled={musicDisabled}
                            onChange={(value) => {
                              const parsed = Number(value)
                              if (!Number.isNaN(parsed)) actions.queueMusic({ inputSelect: parsed as webhmi.InputSelect })
                            }}
                          />
                        </div>
                      )}
                      {hasNumber(musicDb?.bass) && (
                        <NumberControl
                          label="Bass"
                          value={musicDb?.bass ?? undefined}
                          {...musicRanges.bass}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ bass: value })}
                        />
                      )}
                      {hasNumber(musicDb?.mid) && (
                        <NumberControl
                          label="Mid"
                          value={musicDb?.mid ?? undefined}
                          {...musicRanges.mid}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ mid: value })}
                        />
                      )}
                      {hasNumber(musicDb?.midFreq) && (
                        <NumberControl
                          label="Mid Freq (Hz)"
                          value={musicDb?.midFreq ?? undefined}
                          {...musicRanges.midFreq}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ midFreq: Math.round(value) })}
                        />
                      )}
                      {hasNumber(musicDb?.treble) && (
                        <NumberControl
                          label="Treble"
                          value={musicDb?.treble ?? undefined}
                          {...musicRanges.treble}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ treble: value })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMusicNoiseCard && (
                    <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
                      {hasNumber(musicDb?.noise?.gate) && (
                        <NumberControl
                          label="Gate"
                          value={musicDb?.noise?.gate ?? undefined}
                          {...musicRanges.noise.gate}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { gate: value } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.frameTime) && (
                        <NumberControl
                          label="Frame Time"
                          value={musicDb?.noise?.frameTime ?? undefined}
                          {...musicRanges.noise.frameTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { frameTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.atkTime) && (
                        <NumberControl
                          label="Attack Time"
                          value={musicDb?.noise?.atkTime ?? undefined}
                          {...musicRanges.noise.atkTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { atkTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(musicDb?.noise?.relTime) && (
                        <NumberControl
                          label="Release Time"
                          value={musicDb?.noise?.relTime ?? undefined}
                          {...musicRanges.noise.relTime}
                          disabled={musicDisabled}
                          onChange={(value) => actions.queueMusic({ noise: { relTime: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {micDb && (
            <TabsContent value="mic">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower(micKey)}
                  filters={panelStateByKey[micKey].filters}
                  allowedTypesByUiIndex={panelStateByKey[micKey].allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey[micKey].pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  headerExtra={
                    showMicSelector || hasBoolean(micDb?.micEqJointDebugging) ? (
                      <div className="flex items-center gap-4">
                        {showMicSelector && (
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            value={micKey}
                            onValueChange={(v) => v && setMicKey(v as MicPanelKey)}
                            className="gap-0"
                          >
                            <ToggleGroupItem value="mica" className="rounded-r-none">
                              Mic A
                            </ToggleGroupItem>
                            <ToggleGroupItem value="micb" className="rounded-l-none border-l-0">
                              Mic B
                            </ToggleGroupItem>
                          </ToggleGroup>
                        )}
                        {hasBoolean(micDb?.micEqJointDebugging) && (
                          <Toggle
                            variant="outline"
                            pressed={!!micDb?.micEqJointDebugging}
                            onPressedChange={(pressed) => actions.queueMic({ micEqJointDebugging: pressed })}
                            disabled={micDisabled}
                          >
                            Mic EQ Link
                          </Toggle>
                        )}
                      </div>
                    ) : null
                  }
                  handleFilterChange={handleFilterChangeByKey[micKey]}
                  handlePointDoubleClick={handlePointDoubleClickByKey[micKey]}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(panelByKey[micKey].target)}
                  onBypassChange={(pressed) => actions.queueEqBypass(panelByKey[micKey].target, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMicParamsCard && (
                    <ParameterCard className="md:col-span-2" contentClassName="sm:grid-cols-2 md:grid-cols-4">
                      {hasNumber(micDb?.micAVolume) && (
                        <NumberControl
                          label="Mic A Volume"
                          value={micDb?.micAVolume ?? undefined}
                          {...micRanges.micAVolume}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ micAVolume: Math.round(value) })}
                        />
                      )}
                      {hasNumber(micDb?.micBVolume) && (
                        <NumberControl
                          label="Mic B Volume"
                          value={micDb?.micBVolume ?? undefined}
                          {...micRanges.micBVolume}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ micBVolume: Math.round(value) })}
                        />
                      )}

                      {hasNumber(micDb?.micFBX) && (
                        <div className="sm:col-span-2 md:col-span-4">
                          <ToggleGroupControl
                            label="Mic FBX"
                            value={micFbxValue}
                            options={FBX_OPTIONS}
                            disabled={micDisabled}
                            onChange={(value) => {
                              const parsed = Number(value)
                              if (!Number.isNaN(parsed)) actions.queueMic({ micFBX: parsed as webhmi.FbxMode })
                            }}
                          />
                        </div>
                      )}
                      {hasNumber(micDb?.bass) && (
                        <NumberControl
                          label="Bass"
                          value={micDb?.bass ?? undefined}
                          {...micRanges.bass}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ bass: value })}
                        />
                      )}
                      {hasNumber(micDb?.mid) && (
                        <NumberControl
                          label="Mid"
                          value={micDb?.mid ?? undefined}
                          {...micRanges.mid}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ mid: value })}
                        />
                      )}
                      {hasNumber(micDb?.midFreq) && (
                        <NumberControl
                          label="Mid Freq (Hz)"
                          value={micDb?.midFreq ?? undefined}
                          {...micRanges.midFreq}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ midFreq: value })}
                        />
                      )}
                      {hasNumber(micDb?.treble) && (
                        <NumberControl
                          label="Treble"
                          value={micDb?.treble ?? undefined}
                          {...micRanges.treble}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ treble: value })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMicNoiseCard && (
                    <ParameterCard title="Noise Gate" contentClassName="sm:grid-cols-2">
                      {hasNumber(micDb?.noise?.gate) && (
                        <NumberControl
                          label="Gate"
                          value={micDb?.noise?.gate ?? undefined}
                          {...micRanges.noise.gate}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { gate: value } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.frameTime) && (
                        <NumberControl
                          label="Frame Time"
                          value={micDb?.noise?.frameTime ?? undefined}
                          {...micRanges.noise.frameTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { frameTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.atkTime) && (
                        <NumberControl
                          label="Attack Time"
                          value={micDb?.noise?.atkTime ?? undefined}
                          {...micRanges.noise.atkTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { atkTime: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.noise?.relTime) && (
                        <NumberControl
                          label="Release Time"
                          value={micDb?.noise?.relTime ?? undefined}
                          {...micRanges.noise.relTime}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ noise: { relTime: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMicCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(micDb?.compressor?.threshold, micDb?.compressor?.ratio, micDb?.compressor?.attack, micDb?.compressor?.release) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={micDb?.compressor?.threshold}
                            ratio={micDb?.compressor?.ratio}
                            attack={micDb?.compressor?.attack}
                            release={micDb?.compressor?.release}
                            thresholdRange={micRanges.compressor.threshold}
                            disabled={micDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(micDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={micDb?.compressor?.threshold ?? undefined}
                          {...micRanges.compressor.threshold}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={micDb?.compressor?.ratio ?? undefined}
                          {...micRanges.compressor.ratio}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={micDb?.compressor?.attack ?? undefined}
                          {...micRanges.compressor.attack}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(micDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={micDb?.compressor?.release ?? undefined}
                          {...micRanges.compressor.release}
                          disabled={micDisabled}
                          onChange={(value) => actions.queueMic({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(micDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={micDb?.compressor?.bypass}
                          disabled={micDisabled}
                          onChange={(pressed) => actions.queueMic({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {reverbDb && (
            <TabsContent value="reverb">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('reverb')}
                  filters={panelStateByKey.reverb.filters}
                  allowedTypesByUiIndex={panelStateByKey.reverb.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.reverb.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.reverb}
                  handlePointDoubleClick={handlePointDoubleClickByKey.reverb}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.REVERB)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.REVERB, pressed)}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {showReverbCard && (
                    <ParameterCard title="Reverb" className="md:col-span-2" contentClassName="sm:grid-cols-2">
                      {hasNumber(reverbDb?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={reverbDb?.reverbLevel ?? undefined}
                          {...reverbRanges.reverbLevel}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbLevel: Math.round(value) })}
                        />
                      )}
                      {hasNumber(reverbDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={reverbDb?.micDirectLevel ?? undefined}
                          {...reverbRanges.micDirectLevel}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ micDirectLevel: Math.round(value) })}
                        />
                      )}
                      {hasNumber(reverbDb?.reverbPredelay) && (
                        <NumberControl
                          label="Pre-delay"
                          value={reverbDb?.reverbPredelay ?? undefined}
                          {...reverbRanges.reverbPredelay}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(reverbDb?.reverbDecay) && (
                        <NumberControl
                          label="Decay"
                          value={reverbDb?.reverbDecay ?? undefined}
                          {...reverbRanges.reverbDecay}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ reverbDecay: Math.round(value) })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {echoDb && (
            <TabsContent value="echo">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('echo')}
                  filters={panelStateByKey.echo.filters}
                  allowedTypesByUiIndex={panelStateByKey.echo.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.echo.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.echo}
                  handlePointDoubleClick={handlePointDoubleClickByKey.echo}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.ECHO)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.ECHO, pressed)}
                />
                <div className="grid gap-4 md:grid-cols-2">
                  {showEchoCard && (
                    <ParameterCard title="Echo" className="md:col-span-2" contentClassName="sm:grid-cols-2 lg:grid-cols-3">
                      {hasNumber(echoDb?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={echoDb?.echoLevel ?? undefined}
                          {...echoRanges.echoLevel}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoLevel: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={echoDb?.micDirectLevel ?? undefined}
                          {...echoRanges.micDirectLevel}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ micDirectLevel: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoPredelay) && (
                        <NumberControl
                          label="Pre-delay"
                          value={echoDb?.echoPredelay ?? undefined}
                          {...echoRanges.echoPredelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoDelayTime) && (
                        <NumberControl
                          label="Delay Time"
                          value={echoDb?.echoDelayTime ?? undefined}
                          {...echoRanges.echoDelayTime}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoDelayTime: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRepeat) && (
                        <NumberControl
                          label="Repeat"
                          value={echoDb?.echoRepeat ?? undefined}
                          {...echoRanges.echoRepeat}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRepeat: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRightPredelay) && (
                        <NumberControl
                          label="Right Pre-delay"
                          value={echoDb?.echoRightPredelay ?? undefined}
                          {...echoRanges.echoRightPredelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRightPredelay: Math.round(value) })}
                        />
                      )}
                      {hasNumber(echoDb?.echoRightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={echoDb?.echoRightDelay ?? undefined}
                          {...echoRanges.echoRightDelay}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ echoRightDelay: Math.round(value) })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {mainOutputDb && (
            <TabsContent value="mainoutput">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('mainoutput')}
                  filters={panelStateByKey.mainoutput.filters}
                  allowedTypesByUiIndex={panelStateByKey.mainoutput.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.mainoutput.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.mainoutput}
                  handlePointDoubleClick={handlePointDoubleClickByKey.mainoutput}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.MAIN_OUTPUT)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.MAIN_OUTPUT, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showMainOutputOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(mainOutputDb?.output?.leftChannelVolume) && (
                        <NumberControl
                          label="Left Volume"
                          value={mainOutputDb?.output?.leftChannelVolume ?? undefined}
                          {...mainOutputRanges.output.leftChannelVolume}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { leftChannelVolume: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={mainOutputDb?.output?.rightChannelVolume ?? undefined}
                          {...mainOutputRanges.output.rightChannelVolume}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { rightChannelVolume: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.leftDelay) && (
                        <NumberControl
                          label="Left Delay"
                          value={mainOutputDb?.output?.leftDelay ?? undefined}
                          {...mainOutputRanges.output.leftDelay}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { leftDelay: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.rightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={mainOutputDb?.output?.rightDelay ?? undefined}
                          {...mainOutputRanges.output.rightDelay}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { rightDelay: value } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.output?.leftMute) && (
                        <ToggleControl
                          label="Left Mute"
                          pressed={mainOutputDb?.output?.leftMute}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ output: { leftMute: pressed } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.output?.rightMute) && (
                        <ToggleControl
                          label="Right Mute"
                          pressed={mainOutputDb?.output?.rightMute}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ output: { rightMute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMainOutputMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(mainOutputDb?.mixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={mainOutputDb?.mixer?.micDirectLevel ?? undefined}
                          {...mainOutputRanges.mixer.micDirectLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { micDirectLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={mainOutputDb?.mixer?.musicLevel ?? undefined}
                          {...mainOutputRanges.mixer.musicLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { musicLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={mainOutputDb?.mixer?.reverbLevel ?? undefined}
                          {...mainOutputRanges.mixer.reverbLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { reverbLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={mainOutputDb?.mixer?.echoLevel ?? undefined}
                          {...mainOutputRanges.mixer.echoLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { echoLevel: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showMainOutputCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        mainOutputDb?.compressor?.threshold,
                        mainOutputDb?.compressor?.ratio,
                        mainOutputDb?.compressor?.attack,
                        mainOutputDb?.compressor?.release,
                      ) && (
                          <div className="sm:col-span-2">
                            <CompressorGraph
                              threshold={mainOutputDb?.compressor?.threshold}
                              ratio={mainOutputDb?.compressor?.ratio}
                              attack={mainOutputDb?.compressor?.attack}
                              release={mainOutputDb?.compressor?.release}
                              thresholdRange={mainOutputRanges.compressor.threshold}
                              disabled={mainOutputDisabled}
                            />
                          </div>
                        )}
                      {hasNumber(mainOutputDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={mainOutputDb?.compressor?.threshold ?? undefined}
                          {...mainOutputRanges.compressor.threshold}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={mainOutputDb?.compressor?.ratio ?? undefined}
                          {...mainOutputRanges.compressor.ratio}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={mainOutputDb?.compressor?.attack ?? undefined}
                          {...mainOutputRanges.compressor.attack}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(mainOutputDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={mainOutputDb?.compressor?.release ?? undefined}
                          {...mainOutputRanges.compressor.release}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(mainOutputDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={mainOutputDb?.compressor?.bypass}
                          disabled={mainOutputDisabled}
                          onChange={(pressed) => actions.queueMainOutput({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {subOutputDb && (
            <TabsContent value="suboutput">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('suboutput')}
                  filters={panelStateByKey.suboutput.filters}
                  allowedTypesByUiIndex={panelStateByKey.suboutput.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.suboutput.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.suboutput}
                  handlePointDoubleClick={handlePointDoubleClickByKey.suboutput}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.SUB_OUTPUT)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SUB_OUTPUT, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showSubOutputOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(subOutputDb?.output?.volume) && (
                        <NumberControl
                          label="Volume"
                          value={subOutputDb?.output?.volume ?? undefined}
                          {...subOutputRanges.output.volume}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ output: { volume: value } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.output?.delay) && (
                        <NumberControl
                          label="Delay"
                          value={subOutputDb?.output?.delay ?? undefined}
                          {...subOutputRanges.output.delay}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ output: { delay: value } })}
                        />
                      )}
                      {hasBoolean(subOutputDb?.output?.mute) && (
                        <ToggleControl
                          label="Mute"
                          pressed={subOutputDb?.output?.mute}
                          disabled={subOutputDisabled}
                          onChange={(pressed) => actions.queueSubOutput({ output: { mute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSubOutputMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(subOutputDb?.mixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={subOutputDb?.mixer?.micDirectLevel ?? undefined}
                          {...subOutputRanges.mixer.micDirectLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { micDirectLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={subOutputDb?.mixer?.musicLevel ?? undefined}
                          {...subOutputRanges.mixer.musicLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { musicLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={subOutputDb?.mixer?.reverbLevel ?? undefined}
                          {...subOutputRanges.mixer.reverbLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { reverbLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={subOutputDb?.mixer?.echoLevel ?? undefined}
                          {...subOutputRanges.mixer.echoLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { echoLevel: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSubOutputCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        subOutputDb?.compressor?.threshold,
                        subOutputDb?.compressor?.ratio,
                        subOutputDb?.compressor?.attack,
                        subOutputDb?.compressor?.release,
                      ) && (
                          <div className="sm:col-span-2">
                            <CompressorGraph
                              threshold={subOutputDb?.compressor?.threshold}
                              ratio={subOutputDb?.compressor?.ratio}
                              attack={subOutputDb?.compressor?.attack}
                              release={subOutputDb?.compressor?.release}
                              thresholdRange={subOutputRanges.compressor.threshold}
                              disabled={subOutputDisabled}
                            />
                          </div>
                        )}
                      {hasNumber(subOutputDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={subOutputDb?.compressor?.threshold ?? undefined}
                          {...subOutputRanges.compressor.threshold}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={subOutputDb?.compressor?.ratio ?? undefined}
                          {...subOutputRanges.compressor.ratio}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={subOutputDb?.compressor?.attack ?? undefined}
                          {...subOutputRanges.compressor.attack}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(subOutputDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={subOutputDb?.compressor?.release ?? undefined}
                          {...subOutputRanges.compressor.release}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(subOutputDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={subOutputDb?.compressor?.bypass}
                          disabled={subOutputDisabled}
                          onChange={(pressed) => actions.queueSubOutput({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {centerDb && (
            <TabsContent value="center">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('center')}
                  filters={panelStateByKey.center.filters}
                  allowedTypesByUiIndex={panelStateByKey.center.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.center.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.center}
                  handlePointDoubleClick={handlePointDoubleClickByKey.center}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.CENTER)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.CENTER, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showCenterOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(centerDb?.output?.volume) && (
                        <NumberControl
                          label="Volume"
                          value={centerDb?.output?.volume ?? undefined}
                          {...centerRanges.output.volume}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ output: { volume: value } })}
                        />
                      )}
                      {hasNumber(centerDb?.output?.delay) && (
                        <NumberControl
                          label="Delay"
                          value={centerDb?.output?.delay ?? undefined}
                          {...centerRanges.output.delay}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ output: { delay: value } })}
                        />
                      )}
                      {hasBoolean(centerDb?.output?.mute) && (
                        <ToggleControl
                          label="Mute"
                          pressed={centerDb?.output?.mute}
                          disabled={centerDisabled}
                          onChange={(pressed) => actions.queueCenter({ output: { mute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showCenterMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(centerDb?.mixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={centerDb?.mixer?.micDirectLevel ?? undefined}
                          {...centerRanges.mixer.micDirectLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { micDirectLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={centerDb?.mixer?.musicLevel ?? undefined}
                          {...centerRanges.mixer.musicLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { musicLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={centerDb?.mixer?.reverbLevel ?? undefined}
                          {...centerRanges.mixer.reverbLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { reverbLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={centerDb?.mixer?.echoLevel ?? undefined}
                          {...centerRanges.mixer.echoLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { echoLevel: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showCenterCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(centerDb?.compressor?.threshold, centerDb?.compressor?.ratio, centerDb?.compressor?.attack, centerDb?.compressor?.release) && (
                        <div className="sm:col-span-2">
                          <CompressorGraph
                            threshold={centerDb?.compressor?.threshold}
                            ratio={centerDb?.compressor?.ratio}
                            attack={centerDb?.compressor?.attack}
                            release={centerDb?.compressor?.release}
                            thresholdRange={centerRanges.compressor.threshold}
                            disabled={centerDisabled}
                          />
                        </div>
                      )}
                      {hasNumber(centerDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={centerDb?.compressor?.threshold ?? undefined}
                          {...centerRanges.compressor.threshold}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={centerDb?.compressor?.ratio ?? undefined}
                          {...centerRanges.compressor.ratio}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={centerDb?.compressor?.attack ?? undefined}
                          {...centerRanges.compressor.attack}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(centerDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={centerDb?.compressor?.release ?? undefined}
                          {...centerRanges.compressor.release}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(centerDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={centerDb?.compressor?.bypass}
                          disabled={centerDisabled}
                          onChange={(pressed) => actions.queueCenter({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}

          {surroundDb && (
            <TabsContent value="surround">
              <div className="flex flex-col gap-4">
                <DspPanel
                  {...getPanelPower('surround')}
                  filters={panelStateByKey.surround.filters}
                  allowedTypesByUiIndex={panelStateByKey.surround.allowedTypesByUiIndex}
                  pointIndexByUiIndex={panelStateByKey.surround.pointIndexByUiIndex}
                  activeIndex={activeIndex}
                  dragging={dragging}
                  handleFilterChange={handleFilterChangeByKey.surround}
                  handlePointDoubleClick={handlePointDoubleClickByKey.surround}
                  handleMouseEnter={handleMouseEnter}
                  handleMouseLeave={handleMouseLeave}
                  setDragging={setDragging}
                  onReset={() => void actions.resetEq(webhmi.EqTarget.SURROUND)}
                  onBypassChange={(pressed) => actions.queueEqBypass(webhmi.EqTarget.SURROUND, pressed)}
                />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {showSurroundOutputCard && (
                    <ParameterCard title="Output" contentClassName="sm:grid-cols-2">
                      {hasNumber(surroundDb?.output?.leftChannelVolume) && (
                        <NumberControl
                          label="Left Volume"
                          value={surroundDb?.output?.leftChannelVolume ?? undefined}
                          {...surroundRanges.output.leftChannelVolume}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { leftChannelVolume: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={surroundDb?.output?.rightChannelVolume ?? undefined}
                          {...surroundRanges.output.rightChannelVolume}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { rightChannelVolume: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.output?.leftDelay) && (
                        <NumberControl
                          label="Left Delay"
                          value={surroundDb?.output?.leftDelay ?? undefined}
                          {...surroundRanges.output.leftDelay}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { leftDelay: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.output?.rightDelay) && (
                        <NumberControl
                          label="Right Delay"
                          value={surroundDb?.output?.rightDelay ?? undefined}
                          {...surroundRanges.output.rightDelay}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { rightDelay: value } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.output?.leftMute) && (
                        <ToggleControl
                          label="Left Mute"
                          pressed={surroundDb?.output?.leftMute}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ output: { leftMute: pressed } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.output?.rightMute) && (
                        <ToggleControl
                          label="Right Mute"
                          pressed={surroundDb?.output?.rightMute}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ output: { rightMute: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSurroundMixerCard && (
                    <ParameterCard title="Mixer" contentClassName="sm:grid-cols-2">
                      {hasNumber(surroundDb?.mixer?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={surroundDb?.mixer?.micDirectLevel ?? undefined}
                          {...surroundRanges.mixer.micDirectLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { micDirectLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={surroundDb?.mixer?.musicLevel ?? undefined}
                          {...surroundRanges.mixer.musicLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { musicLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={surroundDb?.mixer?.reverbLevel ?? undefined}
                          {...surroundRanges.mixer.reverbLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { reverbLevel: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={surroundDb?.mixer?.echoLevel ?? undefined}
                          {...surroundRanges.mixer.echoLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { echoLevel: Math.round(value) } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                  {showSurroundCompressorCard && (
                    <ParameterCard title="Compressor" contentClassName="sm:grid-cols-2">
                      {hasAny(
                        surroundDb?.compressor?.threshold,
                        surroundDb?.compressor?.ratio,
                        surroundDb?.compressor?.attack,
                        surroundDb?.compressor?.release,
                      ) && (
                          <div className="sm:col-span-2">
                            <CompressorGraph
                              threshold={surroundDb?.compressor?.threshold}
                              ratio={surroundDb?.compressor?.ratio}
                              attack={surroundDb?.compressor?.attack}
                              release={surroundDb?.compressor?.release}
                              thresholdRange={surroundRanges.compressor.threshold}
                              disabled={surroundDisabled}
                            />
                          </div>
                        )}
                      {hasNumber(surroundDb?.compressor?.threshold) && (
                        <NumberControl
                          label="Threshold"
                          value={surroundDb?.compressor?.threshold ?? undefined}
                          {...surroundRanges.compressor.threshold}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { threshold: value } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.ratio) && (
                        <NumberControl
                          label="Ratio"
                          value={surroundDb?.compressor?.ratio ?? undefined}
                          {...surroundRanges.compressor.ratio}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { ratio: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.attack) && (
                        <NumberControl
                          label="Attack"
                          value={surroundDb?.compressor?.attack ?? undefined}
                          {...surroundRanges.compressor.attack}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { attack: Math.round(value) } })}
                        />
                      )}
                      {hasNumber(surroundDb?.compressor?.release) && (
                        <NumberControl
                          label="Release"
                          value={surroundDb?.compressor?.release ?? undefined}
                          {...surroundRanges.compressor.release}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ compressor: { release: Math.round(value) } })}
                        />
                      )}
                      {hasBoolean(surroundDb?.compressor?.bypass) && (
                        <ToggleControl
                          label="Bypass"
                          pressed={surroundDb?.compressor?.bypass}
                          disabled={surroundDisabled}
                          onChange={(pressed) => actions.queueSurround({ compressor: { bypass: pressed } })}
                        />
                      )}
                    </ParameterCard>
                  )}
                </div>
              </div>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}

export default DeviceDemo
