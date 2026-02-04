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
import { useTranslation } from 'react-i18next'
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
import { Separator } from '@/components/ui/separator'
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
// import { useDeviceSessionContext } from '@/device/session/deviceSessionContext'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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

const uiTextKey = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

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
  const { t } = useTranslation()
  const uiText = useCallback((text: string) => t(`uiText.${uiTextKey(text)}`, { defaultValue: text }), [t])
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

  const responsiveScale = useMemo(() => {
    const isMobile = graphWidth < 640
    if (!isMobile) return scale

    return {
      ...scale,
      // On mobile, only show ticks that are in the majorTicks list
      frequencyTicks: scale.frequencyTicks.filter((tick) => scale.majorTicks.includes(tick)),
    }
  }, [graphWidth])

  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-[auto,1fr,auto] items-center gap-3 pb-3">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="secondary">{uiText('Reset')}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{uiText('Reset EQ Settings?')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {uiText(
                    'This will restore all EQ settings for the current panel to their default values. This action cannot be undone.',
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{uiText('Cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={onReset}>{uiText('Reset')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="justify-self-center">{headerExtra}</div>
          <Toggle
            aria-label={uiText('Bypass')}
            variant="outline"
            pressed={bypass}
            onPressedChange={onBypassChange}
          >
            {uiText('Bypass')}
          </Toggle>
        </div>
        <div ref={graphContainerRef} className="shadow-sm shadow-black relative w-full">
          {graphWidth > 0 && (
            <FrequencyResponseGraph
              width={graphWidth}
              height={360}
              theme={responsiveTheme}
              scale={responsiveScale}
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
  const { t } = useTranslation()
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
          <CardTitle className="text-sm">
            {t(`uiText.${uiTextKey(title!)}`, { defaultValue: title })}
          </CardTitle>
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
  extra?: ReactNode
}

function NumberControl({ label, value, step = 1, min, max, disabled, className, onChange, extra }: NumberControlProps) {
  const { t } = useTranslation()
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })
  return (
    <div className={cn("flex items-end gap-1", className)}>
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
        className="flex-1 gap-1"
      >
        <NumberFieldLabel className="text-xs text-muted-foreground">{translatedLabel}</NumberFieldLabel>
        <NumberFieldGroup>
          <NumberFieldDecrementTrigger />
          <NumberFieldInput className="text-sm tabular-nums" />
          <NumberFieldIncrementTrigger />
        </NumberFieldGroup>
      </NumberField>
      {extra && <div className="mb-[1px]">{extra}</div>}
    </div>
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
  const { t } = useTranslation()
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{translatedLabel}</Label>
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
            {t(`uiText.${uiTextKey(option.label)}`, { defaultValue: option.label })}
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
  const { t } = useTranslation()
  const isPressed = !!pressed
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{translatedLabel}</Label>
      <Toggle
        aria-label={translatedLabel}
        variant="outline"
        pressed={isPressed}
        onPressedChange={onChange}
        disabled={disabled}
        className="px-2"
      >
        {isPressed
          ? t(`uiText.${uiTextKey('On')}`, { defaultValue: 'On' })
          : t(`uiText.${uiTextKey('Off')}`, { defaultValue: 'Off' })}
      </Toggle>
    </div>
  )
}

type PhaseInversionToggleProps = {
  pressed?: boolean | null
  disabled?: boolean
  onChange: (pressed: boolean) => void
}

function PhaseInversionToggle({ pressed, disabled, onChange }: PhaseInversionToggleProps) {
  const { t } = useTranslation()
  const isPressed = !!pressed
  return (
    <Toggle
      aria-label={t(`uiText.${uiTextKey('Phase Inversion')}`, { defaultValue: 'Phase Inversion' })}
      variant="outline"
      pressed={isPressed}
      onPressedChange={onChange}
      disabled={disabled}
      className="h-9 w-9 p-0"
    >
      {isPressed ? '-' : '+'}
    </Toggle>
  )
}

const DEFAULT_EQ_POINTS = [
  {
    index: 0,
    type: webhmi.FilterType.HighPass,
    freq: 20,
    gain: 0,
    q: 0.699999988079071,
    defaultType: webhmi.FilterType.HighPass,
    defaultFreq: 20,
    defaultGain: 0,
    defaultQ: 0.699999988079071
  },
  {
    index: 1,
    type: webhmi.FilterType.Peak,
    freq: 666,
    gain: 6,
    q: 1,
    defaultType: webhmi.FilterType.Peak,
    defaultFreq: 666,
    defaultGain: 6,
    defaultQ: 1
  },
  {
    index: 2,
    type: webhmi.FilterType.LowPass,
    freq: 20000,
    gain: 0,
    q: 0.699999988079071,
    defaultType: webhmi.FilterType.LowPass,
    defaultFreq: 20000,
    defaultGain: 0,
    defaultQ: 0.699999988079071
  }
]

const DEFAULT_EQ = {
  point: DEFAULT_EQ_POINTS,
  highPassTypeList: [webhmi.FilterType.HighPass],
  typeList: [webhmi.FilterType.Peak, webhmi.FilterType.LowShelf, webhmi.FilterType.HighShelf],
  lowPassTypeList: [webhmi.FilterType.LowPass],
  bypass: false
}

const INITIAL_DATA = {
  deviceId: 'device demo',
  firmwareVersion: '1.0.0',
  db: {
    system: {
      modeList: ['mode1', 'mode2', 'mode3'],
      bleName: 'WebHMI',
      panelLock: false,
      mute: false,
      musicMaxVolume: 80,
      micMaxVolume: 80,
      effectMaxVolume: 80,
      musicDefaultVolume: 60,
      micDefaultVolume: 60,
      effectDefaultVolume: 60,
      useDefaultVolume: false,
      currentModeIndex: 1,
      musicVolume: 60,
      micVolume: 60,
      effectVolume: 60
    },
    music: {
      eq: DEFAULT_EQ,
      inputGain: 0,
      btGain: 0,
      udiskGain: 0,
      musicPitch: 0,
      inputSelect: webhmi.InputSelect.BT,
      bass: 0,
      mid: 0,
      midFreq: 1000,
      treble: 0,
      noise: { gate: -50, frameTime: 2000, atkTime: 500, relTime: 300 }
    },
    mic: {
      micAEq: { eq: DEFAULT_EQ },
      micBEq: { eq: DEFAULT_EQ },
      micEqJointDebugging: false,
      micAVolume: 75,
      micBVolume: 75,
      micFBX: webhmi.FbxMode.Off,
      bass: 0,
      mid: 0,
      midFreq: 1000,
      treble: 0,
      noise: { gate: -50, frameTime: 2000, atkTime: 500, relTime: 300 },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false }
    },
    reverb: {
      eq: DEFAULT_EQ,
      reverbLevel: 100,
      micDirectLevel: 100,
      reverbPredelay: 20,
      reverbDecay: 2625,
      reverbLevelPhaseInversion: false,
      micDirectLevelPhaseInversion: false
    },
    echo: {
      eq: DEFAULT_EQ,
      echoLevel: 100,
      micDirectLevel: 100,
      echoPredelay: 0,
      echoDelayTime: 200,
      echoRepeat: 60,
      echoRightPredelay: 0,
      echoRightDelay: 0,
      echoLevelPhaseInversion: false,
      micDirectLevelPhaseInversion: false
    },
    mainOutput: {
      eq: DEFAULT_EQ,
      output: {
        leftChannelVolume: 0,
        rightChannelVolume: 0,
        leftDelay: 0,
        rightDelay: 0,
        leftMute: false,
        rightMute: false,
        leftChannelVolumePhaseInversion: false,
        rightChannelVolumePhaseInversion: false
      },
      mixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false }
    },
    subOutput: {
      eq: DEFAULT_EQ,
      output: { volume: 0, delay: 0, mute: false, volumePhaseInversion: false },
      mixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false }
    },
    center: {
      eq: DEFAULT_EQ,
      output: { volume: 0, delay: 0, mute: false, volumePhaseInversion: false },
      mixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false }
    },
    surround: {
      eq: DEFAULT_EQ,
      output: {
        leftChannelVolume: 0,
        rightChannelVolume: 0,
        leftDelay: 0,
        rightDelay: 0,
        leftMute: false,
        rightMute: false,
        leftChannelVolumePhaseInversion: false,
        rightChannelVolumePhaseInversion: false
      },
      mixer: {
        micDirectLevel: 100,
        musicLevel: 100,
        reverbLevel: 100,
        echoLevel: 100,
        micDirectLevelPhaseInversion: false,
        musicLevelPhaseInversion: false,
        reverbLevelPhaseInversion: false,
        echoLevelPhaseInversion: false
      },
      compressor: { threshold: -1, ratio: 10, attack: 50, release: 200, bypass: false }
    }
  }
}

function DemoMode() {
  const { t } = useTranslation()
  const didMountOnceRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [dbResponse, setDbResponse] = useState<webhmi.IGetDbResponse>(INITIAL_DATA as unknown as webhmi.IGetDbResponse)
  const [dbFetchId, setDbFetchId] = useState(0)

  const state = useMemo(() => ({
    db: dbResponse,
    dbFetchId,
    authOk: true as const
  }), [dbResponse, dbFetchId])

  const mergeDb = useCallback((patch: any, path: string[]) => {
    setDbResponse((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      if (!next.db) next.db = {}
      let current = next.db
      for (const p of path) {
        if (!current[p]) current[p] = {}
        current = current[p]
      }

      const deepMerge = (target: any, source: any) => {
        for (const key in source) {
          if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            if (!target[key] || typeof target[key] !== 'object') target[key] = {}
            deepMerge(target[key], source[key])
          } else {
            target[key] = source[key]
          }
        }
      }
      deepMerge(current, patch)

      return next
    })
    setDbFetchId((id) => id + 1)
  }, [])

  const updateEq = useCallback((target: webhmi.EqTarget, updateFn: (eq: any) => void) => {
    setDbResponse((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      const db = next.db
      if (!db) return next
      let eq: any = null
      switch (target) {
        case webhmi.EqTarget.MUSIC: eq = db.music?.eq; break
        case webhmi.EqTarget.MIC_A: eq = db.mic?.micAEq?.eq; break
        case webhmi.EqTarget.MIC_B: eq = db.mic?.micBEq?.eq; break
        case webhmi.EqTarget.REVERB: eq = db.reverb?.eq; break
        case webhmi.EqTarget.ECHO: eq = db.echo?.eq; break
        case webhmi.EqTarget.MAIN_OUTPUT: eq = db.mainOutput?.eq; break
        case webhmi.EqTarget.SUB_OUTPUT: eq = db.subOutput?.eq; break
        case webhmi.EqTarget.CENTER: eq = db.center?.eq; break
        case webhmi.EqTarget.SURROUND: eq = db.surround?.eq; break
      }
      if (eq) updateFn(eq)
      return next
    })
    setDbFetchId((id) => id + 1)
  }, [])

  const actions = useMemo(() => ({
    disconnect: async () => { },
    queueSystem: (p: any) => mergeDb(p, ['system']),
    queueMusic: (p: any) => mergeDb(p, ['music']),
    queueMic: (p: any) => mergeDb(p, ['mic']),
    queueReverb: (p: any) => mergeDb(p, ['reverb']),
    queueEcho: (p: any) => mergeDb(p, ['echo']),
    queueMainOutput: (p: any) => mergeDb(p, ['mainOutput']),
    queueSubOutput: (p: any) => mergeDb(p, ['subOutput']),
    queueCenter: (p: any) => mergeDb(p, ['center']),
    queueSurround: (p: any) => mergeDb(p, ['surround']),

    queueEqBypass: (target: webhmi.EqTarget, bypass: boolean) => {
      updateEq(target, (eq) => { eq.bypass = bypass })
    },
    queueEqPoint: (target: webhmi.EqTarget, point: any) => {
      updateEq(target, (eq) => {
        if (!eq.point) eq.point = []
        const idx = eq.point.findIndex((p: any) => p.index === point.index)
        if (idx >= 0) {
          eq.point[idx] = { ...eq.point[idx], ...point }
        } else {
          eq.point.push(point)
        }
      })
    },
    flushNow: async () => { },
    saveMode: async (index: number) => {
      alert(
        t('demoMode.mode.savedToMode', {
          index,
          defaultValue: 'Saved to mode {{index}}',
        }),
      )
    },
    switchCurrentMode: async (index: number) => {
      mergeDb({ currentModeIndex: index }, ['system'])
    },
    resetEq: async (target: webhmi.EqTarget) => {
      updateEq(target, (eq) => {
        // Reset to default points
        eq.point = JSON.parse(JSON.stringify(DEFAULT_EQ_POINTS))
        eq.bypass = false
      })
    },
    resetEqPointToDefault: async (target: webhmi.EqTarget, index: number) => {
      updateEq(target, (eq) => {
        const defPoint = DEFAULT_EQ_POINTS.find(p => p.index === index)
        if (defPoint && eq.point) {
          const idx = eq.point.findIndex((p: any) => p.index === index)
          if (idx >= 0) {
            eq.point[idx] = { ...defPoint }
          }
        }
      })
    }
  }), [mergeDb, updateEq])

  const disconnect = actions.disconnect

  const cleanInternalFields = useCallback((obj: any): any => {
    if (Array.isArray(obj)) return obj.map(cleanInternalFields)
    if (obj !== null && typeof obj === 'object') {
      const out: any = {}
      for (const [k, v] of Object.entries(obj)) {
        if (!k.startsWith('_')) {
          out[k] = cleanInternalFields(v)
        }
      }
      return out
    }
    return obj
  }, [])

  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false)
  const [exportFilename, setExportFilename] = useState('')
  const uiText = useCallback((text: string) => t(`uiText.${uiTextKey(text)}`, { defaultValue: text }), [t])

  const performExport = useCallback(() => {
    if (!state.db) return
    const cleanDb = cleanInternalFields(state.db)

    // Exclude 'system' parameters from export as requested
    if (cleanDb.db) {
      delete (cleanDb.db as any).system
    }

    const buffer = webhmi.GetDbResponse.encode(cleanDb as webhmi.IGetDbResponse).finish()
    const blob = new Blob([buffer as any], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const finalName = exportFilename.trim() || `device_config_${new Date().toISOString().replace(/[:.]/g, '-')}`
    a.download = `${finalName}.webhmi`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setIsExportDialogOpen(false)
  }, [state.db, cleanInternalFields, exportFilename])

  const handleExport = useCallback(() => {
    const deviceId = state.db?.deviceId || 'device'
    const firmwareVersion = state.db?.firmwareVersion || 'v0'
    setExportFilename(`${deviceId}-${firmwareVersion}-`)
    setIsExportDialogOpen(true)
  }, [state.db])

  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false)
  const [pendingImportData, setPendingImportData] = useState<webhmi.IGetDbResponse | null>(null)
  const [importValidation, setImportValidation] = useState<{
    type: 'error' | 'warning'
    message: string
    title: string
  } | null>(null)

  const applyImportData = useCallback((data: webhmi.IGetDbResponse) => {
    if (!data.db) return

    setDbResponse((prev: any) => {
      const next = JSON.parse(JSON.stringify(prev))
      if (!next.db) next.db = {}

      // Apply top level fields
      if (data.deviceId) next.deviceId = data.deviceId
      if (data.firmwareVersion) next.firmwareVersion = data.firmwareVersion

      // Apply sections present in the imported data
      Object.keys(data.db!).forEach((key) => {
        const val = (data.db as any)[key]
        if (val !== undefined && val !== null) {
          next.db[key] = JSON.parse(JSON.stringify(val))
        }
      })

      return next
    })
    setDbFetchId((id) => id + 1)
  }, [])

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const buffer = await file.arrayBuffer()
        const data = webhmi.GetDbResponse.decode(new Uint8Array(buffer))
        if (!data.db) {
          throw new Error(
            t('demoMode.import.invalidConfigMissingDb', {
              defaultValue: 'Invalid configuration file: missing database content.',
            }),
          )
        }

        const currentDeviceId = state.db?.deviceId
        const currentVersion = state.db?.firmwareVersion

        // 1. Check Device ID (Hard Error)
        if (data.deviceId && currentDeviceId && data.deviceId !== currentDeviceId) {
          setImportValidation({
            type: 'error',
            title: uiText('Device Mismatch'),
            message: t('demoMode.import.deviceMismatch', {
              deviceId: data.deviceId,
              currentDeviceId,
              defaultValue:
                'This configuration file is for "{{deviceId}}", but you are connected to "{{currentDeviceId}}". Importing is not allowed to prevent damage.',
            }),
          })
          setPendingImportData(null)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 2. Check Firmware Version
        const getMajor = (v: string) => v.replace(/^v/i, '').split('.')[0]
        const importMajor = data.firmwareVersion ? getMajor(data.firmwareVersion) : null
        const currentMajor = currentVersion ? getMajor(currentVersion) : null

        // 2a. Major Version Mismatch (Hard Error)
        if (importMajor && currentMajor && importMajor !== currentMajor) {
          setImportValidation({
            type: 'error',
            title: uiText('Critical Version Mismatch'),
            message: t('demoMode.import.criticalVersionMismatch', {
              importMajor,
              currentMajor,
              defaultValue:
                'This configuration (Major v{{importMajor}}) is incompatible with your device (Major v{{currentMajor}}). To prevent damage, importing is not allowed.',
            }),
          })
          setPendingImportData(null)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 2b. Minor/Patch Version Mismatch (Warning)
        if (data.firmwareVersion && currentVersion && data.firmwareVersion !== currentVersion) {
          setImportValidation({
            type: 'warning',
            title: uiText('Version Mismatch'),
            message: t('demoMode.import.versionMismatch', {
              firmwareVersion: data.firmwareVersion,
              currentVersion,
              defaultValue:
                'The configuration version ({{firmwareVersion}}) does not match the device version ({{currentVersion}}). Some parameters might behave unexpectedly. Do you want to continue?',
            }),
          })
          setPendingImportData(data)
          setIsImportConfirmOpen(true)
          e.target.value = ''
          return
        }

        // 3. Perfect match
        applyImportData(data)
        e.target.value = ''
      } catch (err) {
        console.error('Import failed', err)
        alert(
          t('demoMode.import.importFailed', {
            error: err instanceof Error ? err.message : String(err),
            defaultValue: 'Import failed: {{error}}',
          }),
        )
        e.target.value = ''
      }
    },
    [applyImportData, state.db, t, uiText],
  )

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
      { key: 'music', label: uiText('Music'), target: webhmi.EqTarget.MUSIC, getEq: (db) => db?.db?.music?.eq ?? null },
      { key: 'mica', label: uiText('Mic'), target: webhmi.EqTarget.MIC_A, getEq: (db) => db?.db?.mic?.micAEq?.eq ?? null },
      { key: 'micb', label: uiText('Mic'), target: webhmi.EqTarget.MIC_B, getEq: (db) => db?.db?.mic?.micBEq?.eq ?? null },
      { key: 'reverb', label: uiText('Reverb'), target: webhmi.EqTarget.REVERB, getEq: (db) => db?.db?.reverb?.eq ?? null },
      { key: 'echo', label: uiText('Echo'), target: webhmi.EqTarget.ECHO, getEq: (db) => db?.db?.echo?.eq ?? null },
      {
        key: 'mainoutput',
        label: uiText('Main Output'),
        target: webhmi.EqTarget.MAIN_OUTPUT,
        getEq: (db) => db?.db?.mainOutput?.eq ?? null,
      },
      {
        key: 'suboutput',
        label: uiText('Sub Output'),
        target: webhmi.EqTarget.SUB_OUTPUT,
        getEq: (db) => db?.db?.subOutput?.eq ?? null,
      },
      { key: 'center', label: uiText('Center'), target: webhmi.EqTarget.CENTER, getEq: (db) => db?.db?.center?.eq ?? null },
      {
        key: 'surround',
        label: uiText('Surround'),
        target: webhmi.EqTarget.SURROUND,
        getEq: (db) => db?.db?.surround?.eq ?? null,
      },
    ],
    [uiText],
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

  const [isBleRenameDialogOpen, setIsBleRenameDialogOpen] = useState(false)
  const [bleNameDraft, setBleNameDraft] = useState('')
  useEffect(() => {
    const next = systemDb?.bleName ?? ''
    setBleNameDraft((prev) => (prev === next ? prev : next))
  }, [systemDb?.bleName])

  const [isModeRenameDialogOpen, setIsModeRenameDialogOpen] = useState(false)
  const [modeNamesDraft, setModeNamesDraft] = useState<string[]>([])
  useEffect(() => {
    if (!isModeRenameDialogOpen) {
      setModeNamesDraft(systemDb?.modeList ?? [])
    }
  }, [systemDb?.modeList, isModeRenameDialogOpen])

  const [isSaveModeDialogOpen, setIsSaveModeDialogOpen] = useState(false)
  const [saveTargetModeIndex, setSaveTargetModeIndex] = useState<number>(0)
  useEffect(() => {
    if (typeof systemDb?.currentModeIndex === 'number') {
      setSaveTargetModeIndex(systemDb.currentModeIndex)
    }
  }, [systemDb?.currentModeIndex, isSaveModeDialogOpen])

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

  const [dragging, setDraggingState] = useState(false)
  const isDraggingRef = useRef(false)
  const setDragging = useCallback((d: boolean) => {
    isDraggingRef.current = d
    setDraggingState(d)
  }, [])

  const [activeIndex, setActiveIndexState] = useState<number>(0)
  const activeIndexRef = useRef(0)
  const setActiveIndex = useCallback((i: number) => {
    if (activeIndexRef.current === i) return
    activeIndexRef.current = i
    setActiveIndexState(i)
  }, [])
  const [panelStateByKey, setPanelStateByKey] = useState<Record<PanelKey, PanelState>>(() => {
    const out = {} as Record<PanelKey, PanelState>
    for (const panel of panels) out[panel.key] = { filters: [], pointIndexByUiIndex: [], allowedTypesByUiIndex: [] }
    return out
  })

  const panelStateByKeyRef = useRef(panelStateByKey)
  useEffect(() => {
    panelStateByKeyRef.current = panelStateByKey
  }, [panelStateByKey])

  const stateRef = useRef(state)
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const actionsRef = useRef(actions)
  useEffect(() => {
    actionsRef.current = actions
  }, [actions])

  useEffect(() => {
    if (isDraggingRef.current) return

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
    if (!isDraggingRef.current) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!isDraggingRef.current) setActiveIndex(index)
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

      // Ensure active state and dragging state are maintained during any interaction
      if (!ended) {
        setActiveIndex(uiIndex)
        setDragging(true)
      } else {
        setDragging(false)
      }

      const jointDebug = stateRef.current.db?.db?.mic?.micEqJointDebugging
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

        const patches = new Map<PanelKey, Map<number, Partial<GraphFilter>>>()
        patches.set(key, new Map([[uiIndex, filter]]))
        if (otherKey) patches.set(otherKey, new Map([[uiIndex, filter]]))

        applyUiPatches(patches)
      } else {
        const byIndex = pendingUiPatchesRef.current.get(key) ?? new Map<number, Partial<GraphFilter>>()
        byIndex.set(uiIndex, filter)
        pendingUiPatchesRef.current.set(key, byIndex)

        if (otherKey) {
          const byIndexOther = pendingUiPatchesRef.current.get(otherKey) ?? new Map<number, Partial<GraphFilter>>()
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

      // Optimization: Only queue if the rounded values have actually changed in our local DB view
      const sourceDb = stateRef.current.db
      if (sourceDb) {
        const currentEq = def.getEq(sourceDb)
        if (currentEq?.point) {
          const cp = currentEq.point.find((p) => p && p.index === deviceIndex)
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
      actionsRef.current.queueEqPoint(def.target, pointPatch)

      // Sync changes if Mic Joint Debugging is enabled
      // `jointDebug` and `otherKey` already calculated above
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
    (key: PanelKey, filterEvent: FilterPointEvent) => {
      const def = panelByKey[key]
      const stateForPanel = panelStateByKeyRef.current[key]
      if (!def || !stateForPanel) return

      const uiIndex = filterEvent.index
      const deviceIndex = stateForPanel.pointIndexByUiIndex[uiIndex] ?? uiIndex
      void actionsRef.current.resetEqPointToDefault(def.target, deviceIndex)

      // Sync changes if Mic Joint Debugging is enabled
      const jointDebug = stateForPanel.pointIndexByUiIndex.length > 0 && stateRef.current.db?.db?.mic?.micEqJointDebugging
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
            <CardContent className="p-4 flex flex-wrap items-end gap-x-6 gap-y-4 justify-center">
              <div className="flex items-end gap-12">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">{uiText('Device')}</Label>
                  <div className="h-9 flex items-center">
                    <span className="text-sm font-semibold text-white tracking-wide">{state.db?.deviceId || '-'}</span>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs text-muted-foreground font-medium">{uiText('Version')}</Label>
                  <div className="h-9 flex items-center">
                    <span className="text-sm font-semibold text-white tracking-wide">{state.db?.firmwareVersion || '-'}</span>
                  </div>
                </div>
              </div>

              <Separator orientation="vertical" className="hidden sm:block h-14 self-center mx-6 bg-zinc-700" />
              <Separator orientation="horizontal" className="sm:hidden w-full bg-zinc-800 my-2" />

              <div className="flex flex-wrap items-end gap-6 justify-center">

                <NumberControl
                  label="Music Volume"
                  value={systemDb.musicVolume ?? undefined}
                  min={0}
                  max={typeof systemDb.musicMaxVolume === 'number' ? systemDb.musicMaxVolume : undefined}
                  disabled={systemDisabled}
                  className="w-32"
                  onChange={(value) => {
                    const max = systemDb?.musicMaxVolume ?? 100
                    actions.queueSystem({ musicVolume: Math.min(Math.round(value), max) })
                  }}
                />
                <NumberControl
                  label="Mic Volume"
                  value={systemDb.micVolume ?? undefined}
                  min={0}
                  max={typeof systemDb.micMaxVolume === 'number' ? systemDb.micMaxVolume : undefined}
                  disabled={systemDisabled}
                  className="w-32"
                  onChange={(value) => {
                    const max = systemDb?.micMaxVolume ?? 100
                    actions.queueSystem({ micVolume: Math.min(Math.round(value), max) })
                  }}
                />
                <NumberControl
                  label="Effect Volume"
                  value={systemDb.effectVolume ?? undefined}
                  min={0}
                  max={typeof systemDb.effectMaxVolume === 'number' ? systemDb.effectMaxVolume : undefined}
                  disabled={systemDisabled}
                  className="w-32"
                  onChange={(value) => {
                    const max = systemDb?.effectMaxVolume ?? 100
                    actions.queueSystem({ effectVolume: Math.min(Math.round(value), max) })
                  }}
                />
                <div className="flex items-center h-[56px] pb-1">
                  <ToggleControl
                    label="Mute"
                    pressed={systemDb.mute ?? undefined}
                    disabled={systemDisabled}
                    onChange={(pressed) => actions.queueSystem({ mute: pressed })}
                  />
                </div>
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
            {musicDb && <TabsTrigger value="music">{uiText('Music')}</TabsTrigger>}
            {micDb && <TabsTrigger value="mic">{uiText('Mic')}</TabsTrigger>}
            {reverbDb && <TabsTrigger value="reverb">{uiText('Reverb')}</TabsTrigger>}
            {echoDb && <TabsTrigger value="echo">{uiText('Echo')}</TabsTrigger>}
            {mainOutputDb && <TabsTrigger value="mainoutput">{uiText('Main Output')}</TabsTrigger>}
            {subOutputDb && <TabsTrigger value="suboutput">{uiText('Sub Output')}</TabsTrigger>}
            {centerDb && <TabsTrigger value="center">{uiText('Center')}</TabsTrigger>}
            {surroundDb && <TabsTrigger value="surround">{uiText('Surround')}</TabsTrigger>}
            {systemDb && <TabsTrigger value="system">{uiText('System')}</TabsTrigger>}
          </TabsList>

          {systemDb && (
            <TabsContent value="system">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <ParameterCard contentClassName="sm:grid-cols-2">
                    <div className="grid gap-1 sm:col-span-2">
                      <Label className="text-xs text-muted-foreground">{uiText('BLE Name')}</Label>
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">{systemDb.bleName || '-'}</Label>
                        <Button
                          variant="outline"
                          disabled={systemDisabled}
                          onClick={() => {
                            setBleNameDraft(systemDb.bleName || '')
                            setIsBleRenameDialogOpen(true)
                          }}
                        >
                          {uiText('Rename')}
                        </Button>
                      </div>
                    </div>

                    <ToggleControl
                      label="Panel Lock"
                      pressed={systemDb.panelLock ?? undefined}
                      disabled={systemDisabled}
                      onChange={(pressed) => actions.queueSystem({ panelLock: pressed })}
                    />
                  </ParameterCard>

                  <Dialog open={isBleRenameDialogOpen} onOpenChange={setIsBleRenameDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{uiText('Rename Bluetooth Device')}</DialogTitle>
                        <DialogDescription>
                          {uiText('Enter a new name for the BLE device.')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="ble-name">{uiText('New BLE Name')}</Label>
                          <Input
                            id="ble-name"
                            value={bleNameDraft}
                            maxLength={64}
                            onChange={(e) => {
                              const val = e.target.value
                              if (new TextEncoder().encode(val).length <= 64) {
                                setBleNameDraft(val)
                              }
                            }}
                            placeholder={uiText('Enter BLE name')}
                            onKeyDown={(e) => {
                              if (e.key !== 'Enter') return
                              e.preventDefault()
                              const next = bleNameDraft.trim()
                              if (systemDisabled || !next || next === (systemDb.bleName ?? '')) return
                              actions.queueSystem({ bleName: next })
                              void actions.flushNow()
                              setIsBleRenameDialogOpen(false)
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsBleRenameDialogOpen(false)}>
                          {uiText('Cancel')}
                        </Button>
                        <Button
                          disabled={
                            systemDisabled || !bleNameDraft.trim() || bleNameDraft.trim() === (systemDb.bleName ?? '')
                          }
                          onClick={() => {
                            const next = bleNameDraft.trim()
                            if (!next) return
                            actions.queueSystem({ bleName: next })
                            void actions.flushNow()
                            setIsBleRenameDialogOpen(false)
                          }}
                        >
                          {uiText('Modify')}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <Dialog open={isExportDialogOpen} onOpenChange={setIsExportDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>{uiText('Export Configuration')}</DialogTitle>
                        <DialogDescription>
                          {uiText('Specify a name for your configuration file.')}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="filename">{uiText('File Name')}</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              id="filename"
                              value={exportFilename}
                              onChange={(e) => setExportFilename(e.target.value)}
                              placeholder={uiText('Enter filename')}
                              className="flex-1"
                            />
                            <span className="text-sm text-muted-foreground">.webhmi</span>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setIsExportDialogOpen(false)}>
                          {uiText('Cancel')}
                        </Button>
                        <Button onClick={performExport}>{uiText('Export')}</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <ParameterCard title="Mode" contentClassName="sm:grid-cols-2">
                    {systemModeOptions.length > 0 && (
                      <>
                        <div className="grid gap-1.5 sm:col-span-2">
                          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground/70 font-medium px-0.5">
                            {uiText('Current Mode')}
                          </Label>
                          <Select
                            value={systemModeValue}
                            onValueChange={(value) => void actions.switchCurrentMode(Number(value))}
                            disabled={systemDisabled}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={uiText('Select mode')} />
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

                        <div className="grid grid-cols-2 gap-2 mt-1 sm:col-span-2">
                          <Button
                            variant="outline"
                            className="text-xs h-9"
                            disabled={systemDisabled || !systemDb?.modeList?.length}
                            onClick={() => {
                              if (typeof systemDb?.currentModeIndex === 'number') setSaveTargetModeIndex(systemDb.currentModeIndex)
                              setIsSaveModeDialogOpen(true)
                            }}
                          >
                            {uiText('Save')}
                          </Button>
                          <Button
                            variant="outline"
                            className="text-xs h-9"
                            disabled={systemDisabled || !systemDb?.modeList?.length}
                            onClick={() => {
                              setModeNamesDraft(systemDb?.modeList ?? [])
                              setIsModeRenameDialogOpen(true)
                            }}
                          >
                            {uiText('Rename')}
                          </Button>
                        </div>
                      </>
                    )}

                    <Dialog open={isSaveModeDialogOpen} onOpenChange={setIsSaveModeDialogOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{uiText('Save Current to Mode')}</DialogTitle>
                          <DialogDescription>
                            {uiText(
                              'This will overwrite the selected mode with your current parameters. This action cannot be undone.',
                            )}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label>{uiText('Target Mode')}</Label>
                            <Select
                              value={String(saveTargetModeIndex)}
                              onValueChange={(v) => setSaveTargetModeIndex(Number(v))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={uiText('Select mode')} />
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
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsSaveModeDialogOpen(false)}>
                            {uiText('Cancel')}
                          </Button>
                          <Button
                            variant="destructive"
                            onClick={async () => {
                              await actions.saveMode(saveTargetModeIndex)
                              setIsSaveModeDialogOpen(false)
                            }}
                          >
                            {uiText('Confirm Save')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isModeRenameDialogOpen} onOpenChange={setIsModeRenameDialogOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle>{uiText('Rename Modes')}</DialogTitle>
                          <DialogDescription>
                            {uiText('Enter new names for all available modes.')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-2">
                          {modeNamesDraft.map((name, index) => (
                            <div key={index} className="grid gap-2">
                              <Label htmlFor={`mode-name-${index}`}>
                                {uiText('Mode')} {index + 1}
                              </Label>
                              <Input
                                id={`mode-name-${index}`}
                                value={name}
                                maxLength={64}
                                onChange={(e) => {
                                  const val = e.target.value
                                  if (new TextEncoder().encode(val).length <= 64) {
                                    const next = [...modeNamesDraft]
                                    next[index] = val
                                    setModeNamesDraft(next)
                                  }
                                }}
                                placeholder={t('demoMode.mode.enterName', {
                                  index: index + 1,
                                  defaultValue: 'Enter mode {{index}} name',
                                })}
                              />
                            </div>
                          ))}
                        </div>
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setIsModeRenameDialogOpen(false)}>
                            {uiText('Cancel')}
                          </Button>
                          <Button
                            disabled={
                              systemDisabled ||
                              modeNamesDraft.some(n => !n.trim()) ||
                              JSON.stringify(modeNamesDraft.map(n => n.trim())) === JSON.stringify(systemDb?.modeList ?? [])
                            }
                            onClick={() => {
                              const nextModes = modeNamesDraft.map(n => n.trim())
                              actions.queueSystem({ modeList: nextModes })
                              void actions.flushNow()
                              setIsModeRenameDialogOpen(false)
                            }}
                          >
                            {uiText('Save Changes')}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={isImportConfirmOpen} onOpenChange={setIsImportConfirmOpen}>
                      <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                          <DialogTitle className={cn(importValidation?.type === 'error' ? 'text-destructive' : 'text-warning')}>
                            {importValidation?.title}
                          </DialogTitle>
                          <DialogDescription>
                            {importValidation?.message}
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          {importValidation?.type === 'error' ? (
                            <Button onClick={() => setIsImportConfirmOpen(false)}>{uiText('Close')}</Button>
                          ) : (
                            <>
                              <Button variant="outline" onClick={() => setIsImportConfirmOpen(false)}>
                                {uiText('Cancel')}
                              </Button>
                              <Button
                                variant="destructive"
                                onClick={() => {
                                  if (pendingImportData) {
                                    applyImportData(pendingImportData)
                                    setIsImportConfirmOpen(false)
                                    setPendingImportData(null)
                                  }
                                }}
                              >
                                {uiText('Import Anyway')}
                              </Button>
                            </>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    <Separator className="sm:col-span-2 my-2" />
                    <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                      <Button
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={systemDisabled}
                      >
                        {uiText('Import')}
                      </Button>
                      <Button variant="outline" onClick={handleExport} disabled={systemDisabled}>
                        {uiText('Export')}
                      </Button>
                      <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept=".webhmi"
                        onChange={handleImport}
                      />
                    </div>
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
                      onChange={(value) => {
                        const max = systemDb?.musicMaxVolume ?? 100
                        actions.queueSystem({ musicDefaultVolume: Math.min(Math.round(value), max) })
                      }}
                    />
                    <NumberControl
                      label="Mic Default"
                      value={systemDb.micDefaultVolume ?? undefined}
                      min={0}
                      max={typeof systemDb.micMaxVolume === 'number' ? systemDb.micMaxVolume : undefined}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const max = systemDb?.micMaxVolume ?? 100
                        actions.queueSystem({ micDefaultVolume: Math.min(Math.round(value), max) })
                      }}
                    />
                    <NumberControl
                      label="Effect Default"
                      value={systemDb.effectDefaultVolume ?? undefined}
                      min={0}
                      max={typeof systemDb.effectMaxVolume === 'number' ? systemDb.effectMaxVolume : undefined}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const max = systemDb?.effectMaxVolume ?? 100
                        actions.queueSystem({ effectDefaultVolume: Math.min(Math.round(value), max) })
                      }}
                    />
                  </ParameterCard>

                  <ParameterCard title="Limits" contentClassName="sm:grid-cols-2">
                    <NumberControl
                      label="Music Max"
                      value={systemDb.musicMaxVolume ?? undefined}
                      min={systemDb.musicDefaultVolume ?? 0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = Math.round(value)
                        const def = systemDb?.musicDefaultVolume ?? 0
                        const cur = systemDb?.musicVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { musicMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.musicVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
                    />
                    <NumberControl
                      label="Mic Max"
                      value={systemDb.micMaxVolume ?? undefined}
                      min={systemDb.micDefaultVolume ?? 0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = Math.round(value)
                        const def = systemDb?.micDefaultVolume ?? 0
                        const cur = systemDb?.micVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { micMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.micVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
                    />
                    <NumberControl
                      label="Effect Max"
                      value={systemDb.effectMaxVolume ?? undefined}
                      min={systemDb.effectDefaultVolume ?? 0}
                      max={80}
                      disabled={systemDisabled}
                      onChange={(value) => {
                        const rounded = Math.round(value)
                        const def = systemDb?.effectDefaultVolume ?? 0
                        const cur = systemDb?.effectVolume ?? 0
                        const validMax = Math.max(rounded, def)
                        const updates: any = { effectMaxVolume: validMax }
                        if (validMax < cur) {
                          updates.effectVolume = validMax
                        }
                        actions.queueSystem(updates)
                      }}
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
                        {showMicSelector && hasBoolean(micDb?.micEqJointDebugging) && (
                          <Toggle
                            variant="outline"
                            pressed={!!micDb?.micEqJointDebugging}
                            onPressedChange={(pressed) => {
                              if (pressed) {
                                const sourceKey = micKey
                                const targetKey = micKey === 'mica' ? 'micb' : 'mica'
                                const sourcePanel = panelByKey[sourceKey]
                                const targetPanel = panelByKey[targetKey]
                                const sourceEq = sourcePanel?.getEq(state.db)

                                if (sourceEq && targetPanel) {
                                  // Copy bypass
                                  if (typeof sourceEq.bypass === 'boolean') {
                                    actions.queueEqBypass(targetPanel.target, sourceEq.bypass)
                                  }
                                  // Copy points
                                  if (Array.isArray(sourceEq.point)) {
                                    for (const p of sourceEq.point) {
                                      actions.queueEqPoint(targetPanel.target, p)
                                    }
                                  }
                                }
                              }
                              actions.queueMic({ micEqJointDebugging: pressed })
                            }}
                            disabled={micDisabled}
                          >
                            {uiText('Mic EQ Link')}
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
                  onReset={() => {
                    void actions.resetEq(panelByKey[micKey].target)
                    if (state.db?.db?.mic?.micEqJointDebugging) {
                      const otherKey = micKey === 'mica' ? 'micb' : 'mica'
                      void actions.resetEq(panelByKey[otherKey].target)
                    }
                  }}
                  onBypassChange={(pressed) => {
                    actions.queueEqBypass(panelByKey[micKey].target, pressed)
                    if (state.db?.db?.mic?.micEqJointDebugging) {
                      const otherKey = micKey === 'mica' ? 'micb' : 'mica'
                      actions.queueEqBypass(panelByKey[otherKey].target, pressed)
                    }
                  }}
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
                          extra={
                            hasBoolean(reverbDb?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={reverbDb?.reverbLevelPhaseInversion}
                                disabled={reverbDisabled}
                                onChange={(pressed) => actions.queueReverb({ reverbLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(reverbDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={reverbDb?.micDirectLevel ?? undefined}
                          {...reverbRanges.micDirectLevel}
                          disabled={reverbDisabled}
                          onChange={(value) => actions.queueReverb({ micDirectLevel: Math.round(value) })}
                          extra={
                            hasBoolean(reverbDb?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={reverbDb?.micDirectLevelPhaseInversion}
                                disabled={reverbDisabled}
                                onChange={(pressed) => actions.queueReverb({ micDirectLevelPhaseInversion: pressed })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(echoDb?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={echoDb?.echoLevelPhaseInversion}
                                disabled={echoDisabled}
                                onChange={(pressed) => actions.queueEcho({ echoLevelPhaseInversion: pressed })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(echoDb?.micDirectLevel) && (
                        <NumberControl
                          label="Mic Direct Level"
                          value={echoDb?.micDirectLevel ?? undefined}
                          {...echoRanges.micDirectLevel}
                          disabled={echoDisabled}
                          onChange={(value) => actions.queueEcho({ micDirectLevel: Math.round(value) })}
                          extra={
                            hasBoolean(echoDb?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={echoDb?.micDirectLevelPhaseInversion}
                                disabled={echoDisabled}
                                onChange={(pressed) => actions.queueEcho({ micDirectLevelPhaseInversion: pressed })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(mainOutputDb?.output?.leftChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.output?.leftChannelVolumePhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ output: { leftChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={mainOutputDb?.output?.rightChannelVolume ?? undefined}
                          {...mainOutputRanges.output.rightChannelVolume}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ output: { rightChannelVolume: value } })}
                          extra={
                            hasBoolean(mainOutputDb?.output?.rightChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.output?.rightChannelVolumePhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ output: { rightChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(mainOutputDb?.mixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.mixer?.micDirectLevelPhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ mixer: { micDirectLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={mainOutputDb?.mixer?.musicLevel ?? undefined}
                          {...mainOutputRanges.mixer.musicLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { musicLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(mainOutputDb?.mixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.mixer?.musicLevelPhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ mixer: { musicLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={mainOutputDb?.mixer?.reverbLevel ?? undefined}
                          {...mainOutputRanges.mixer.reverbLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { reverbLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(mainOutputDb?.mixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.mixer?.reverbLevelPhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ mixer: { reverbLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(mainOutputDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={mainOutputDb?.mixer?.echoLevel ?? undefined}
                          {...mainOutputRanges.mixer.echoLevel}
                          disabled={mainOutputDisabled}
                          onChange={(value) => actions.queueMainOutput({ mixer: { echoLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(mainOutputDb?.mixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={mainOutputDb?.mixer?.echoLevelPhaseInversion}
                                disabled={mainOutputDisabled}
                                onChange={(pressed) => actions.queueMainOutput({ mixer: { echoLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(subOutputDb?.output?.volumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.output?.volumePhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ output: { volumePhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(subOutputDb?.mixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.mixer?.micDirectLevelPhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ mixer: { micDirectLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={subOutputDb?.mixer?.musicLevel ?? undefined}
                          {...subOutputRanges.mixer.musicLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { musicLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(subOutputDb?.mixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.mixer?.musicLevelPhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ mixer: { musicLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={subOutputDb?.mixer?.reverbLevel ?? undefined}
                          {...subOutputRanges.mixer.reverbLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { reverbLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(subOutputDb?.mixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.mixer?.reverbLevelPhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ mixer: { reverbLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(subOutputDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={subOutputDb?.mixer?.echoLevel ?? undefined}
                          {...subOutputRanges.mixer.echoLevel}
                          disabled={subOutputDisabled}
                          onChange={(value) => actions.queueSubOutput({ mixer: { echoLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(subOutputDb?.mixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={subOutputDb?.mixer?.echoLevelPhaseInversion}
                                disabled={subOutputDisabled}
                                onChange={(pressed) => actions.queueSubOutput({ mixer: { echoLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(centerDb?.output?.volumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.output?.volumePhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ output: { volumePhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(centerDb?.mixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.mixer?.micDirectLevelPhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ mixer: { micDirectLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={centerDb?.mixer?.musicLevel ?? undefined}
                          {...centerRanges.mixer.musicLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { musicLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(centerDb?.mixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.mixer?.musicLevelPhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ mixer: { musicLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={centerDb?.mixer?.reverbLevel ?? undefined}
                          {...centerRanges.mixer.reverbLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { reverbLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(centerDb?.mixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.mixer?.reverbLevelPhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ mixer: { reverbLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(centerDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={centerDb?.mixer?.echoLevel ?? undefined}
                          {...centerRanges.mixer.echoLevel}
                          disabled={centerDisabled}
                          onChange={(value) => actions.queueCenter({ mixer: { echoLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(centerDb?.mixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={centerDb?.mixer?.echoLevelPhaseInversion}
                                disabled={centerDisabled}
                                onChange={(pressed) => actions.queueCenter({ mixer: { echoLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(surroundDb?.output?.leftChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.output?.leftChannelVolumePhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ output: { leftChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.output?.rightChannelVolume) && (
                        <NumberControl
                          label="Right Volume"
                          value={surroundDb?.output?.rightChannelVolume ?? undefined}
                          {...surroundRanges.output.rightChannelVolume}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ output: { rightChannelVolume: value } })}
                          extra={
                            hasBoolean(surroundDb?.output?.rightChannelVolumePhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.output?.rightChannelVolumePhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ output: { rightChannelVolumePhaseInversion: pressed } })}
                              />
                            )
                          }
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
                          extra={
                            hasBoolean(surroundDb?.mixer?.micDirectLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.mixer?.micDirectLevelPhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ mixer: { micDirectLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.musicLevel) && (
                        <NumberControl
                          label="Music Level"
                          value={surroundDb?.mixer?.musicLevel ?? undefined}
                          {...surroundRanges.mixer.musicLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { musicLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(surroundDb?.mixer?.musicLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.mixer?.musicLevelPhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ mixer: { musicLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.reverbLevel) && (
                        <NumberControl
                          label="Reverb Level"
                          value={surroundDb?.mixer?.reverbLevel ?? undefined}
                          {...surroundRanges.mixer.reverbLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { reverbLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(surroundDb?.mixer?.reverbLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.mixer?.reverbLevelPhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ mixer: { reverbLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
                        />
                      )}
                      {hasNumber(surroundDb?.mixer?.echoLevel) && (
                        <NumberControl
                          label="Echo Level"
                          value={surroundDb?.mixer?.echoLevel ?? undefined}
                          {...surroundRanges.mixer.echoLevel}
                          disabled={surroundDisabled}
                          onChange={(value) => actions.queueSurround({ mixer: { echoLevel: Math.round(value) } })}
                          extra={
                            hasBoolean(surroundDb?.mixer?.echoLevelPhaseInversion) && (
                              <PhaseInversionToggle
                                pressed={surroundDb?.mixer?.echoLevelPhaseInversion}
                                disabled={surroundDisabled}
                                onChange={(pressed) => actions.queueSurround({ mixer: { echoLevelPhaseInversion: pressed } })}
                              />
                            )
                          }
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
    </div >
  )
}

export default DemoMode
