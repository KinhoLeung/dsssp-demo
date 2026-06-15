import {
  CompositeCurve,
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

import type { EqRangeConfig } from '../../configs/parameterRanges'
import scale from '../../configs/scale'
import theme, { getTheme } from '../../configs/theme'
import FilterCard from '../FilterCard'

import { uiTextKey } from './dspUtils'

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'


export type DspPanelProps = {
  powered: boolean
  bypass: boolean
  filters: GraphFilter[]
  allowedTypesByUiIndex: Array<FilterType[] | null>
  pointIndexByUiIndex: number[]
  activeIndex: number
  dragging: boolean
  eqRange?: EqRangeConfig
  headerExtra?: ReactNode
  handleFilterChange: (filterEvent: FilterChangeEvent) => void
  handlePointDoubleClick: (filterEvent: FilterPointEvent) => void
  handleMouseEnter: ({ index }: { index: number }) => void
  handleMouseLeave: () => void
  setDragging: (dragging: boolean) => void
  onReset: () => void
  onBypassChange: (bypass: boolean) => void
}

export function DspPanel({
  powered,
  bypass,
  filters,
  allowedTypesByUiIndex,
  pointIndexByUiIndex,
  activeIndex,
  dragging,
  eqRange,
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
    const rangedScale = eqRange
      ? {
          ...scale,
          minFreq: eqRange.freq.min,
          maxFreq: eqRange.freq.max,
          minGain: eqRange.gain.min,
          maxGain: eqRange.gain.max,
          minQ: eqRange.q.min,
          maxQ: eqRange.q.max,
          displayMinFreq: Math.min(scale.displayMinFreq, eqRange.freq.min),
          displayMaxFreq: Math.max(scale.displayMaxFreq, eqRange.freq.max),
          displayMinGain: Math.min(scale.displayMinGain, eqRange.gain.min),
          displayMaxGain: Math.max(scale.displayMaxGain, eqRange.gain.max),
          frequencyTicks: scale.frequencyTicks.filter((tick) => tick >= eqRange.freq.min && tick <= eqRange.freq.max),
          octaveLabels: scale.octaveLabels.filter((tick) => tick >= eqRange.freq.min && tick <= eqRange.freq.max),
          majorTicks: scale.majorTicks.filter((tick) => tick >= eqRange.freq.min && tick <= eqRange.freq.max),
        }
      : scale
    const isMobile = graphWidth < 640
    if (!isMobile) return rangedScale

    return {
      ...rangedScale,
      // On mobile, only show ticks that are in the majorTicks list
      frequencyTicks: rangedScale.frequencyTicks.filter((tick) => rangedScale.majorTicks.includes(tick)),
    }
  }, [eqRange, graphWidth])

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

          <div className="absolute top-0 left-0 w-full h-full pointer-events-none bg-transparent mix-blend-overlay"></div>
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
              eqRange={eqRange}
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
                  eqRange={eqRange}
                />
              </TabsContent>
            ))}
          </Tabs>
        </div>
      </CardContent>
    </Card>
  )
}
