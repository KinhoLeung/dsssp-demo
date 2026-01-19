import {
  FrequencyResponseGraph,
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  type FilterChangeEvent,
  FilterPoint,
  PointerTracker,
  FilterIcon,
  type GraphFilter
} from 'dsssp'
import { Fragment, useEffect, useRef, useState, useCallback } from 'react'

import { FilterCard } from '../components'
import { customPreset } from '../configs/presets'
import scale from '../configs/scale'
import theme from '../configs/theme'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger
} from '@/components/ui/tabs'
import { Toggle } from '@/components/ui/toggle'

type DspPanelProps = {
  powered: boolean
  filters: GraphFilter[]
  activeIndex: number
  dragging: number
  handleFilterChange: (filterEvent: FilterChangeEvent) => void
  handleMouseEnter: ({ index }: { index: number }) => void
  handleMouseLeave: () => void
  setDragging: (dragging: boolean) => void
}

function DspPanel({
  powered,
  filters,
  activeIndex,
  dragging,
  handleFilterChange,
  handleMouseEnter,
  handleMouseLeave,
  setDragging
}: DspPanelProps) {
  const [graphWidth, setGraphWidth] = useState(0)
  const graphContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = graphContainerRef.current
    if (!element) return

    const updateWidth = () => {
      setGraphWidth(element.clientWidth)
    }

    updateWidth()
    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  return (
    <Card className="border-none shadow-none bg-transparent">
      <CardContent className="p-0">
        <div ref={graphContainerRef} className="relative aspect-[21/9] w-full">
          {graphWidth > 0 && (
            <FrequencyResponseGraph
              width={graphWidth}
              height={graphWidth * (9 / 21)}
              scale={scale}
              theme={theme}
              className="rounded-lg overflow-hidden border border-zinc-900 shadow-2xl bg-black/40 backdrop-blur-sm"
            >
              {filters.map((filter, index) => (
                <Fragment key={index}>
                  {activeIndex === index && (
                    <>
                      <FilterGradient fill={true} index={index} filter={filter} />
                      <FilterCurve index={index} filter={filter} active={true} />
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
                  dragging={dragging === index}
                  onEnter={handleMouseEnter}
                  onLeave={handleMouseLeave}
                  onChange={handleFilterChange}
                  onDrag={setDragging}
                  label={filter.type.includes('LOWPASS') || filter.type.includes('HIGHPASS') ? '' : String(index + 1)}
                />
              ))}
              {dragging === -1 && <PointerTracker />}
            </FrequencyResponseGraph>
          )}
        </div>

        {/* Desktop View: All filter cards in a row */}
        <div className="hidden sm:flex gap-1 w-full pt-2">
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

        {/* Mobile View: Tabbed filter cards */}
        <div className="sm:hidden pt-4">
          <Tabs
            value={String(activeIndex >= 0 ? activeIndex : 0)}
            onValueChange={(val) => handleMouseEnter({ index: Number(val) })}
          >
            <TabsList className="bg-transparent h-auto p-0 flex-wrap justify-start gap-2 mb-4 shrink-0 overflow-x-auto no-scrollbar">
              {filters.map((filter, i) => {
                const label = i + 1
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

export default function DemoMode() {
  const [powered, setPowered] = useState(true)
  const [filters, setFilters] = useState<GraphFilter[]>(customPreset)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [dragging, setDragging] = useState(-1)

  const handleFilterChange = useCallback((filterEvent: FilterChangeEvent) => {
    setFilters((prev) => {
      const next = [...prev]
      const { index, ...patch } = filterEvent
      next[index] = { ...next[index], ...patch } as GraphFilter
      return next
    })
  }, [])

  const handleMouseEnter = useCallback(({ index }: { index: number }) => {
    if (dragging === -1) setActiveIndex(index)
  }, [dragging])

  const handleMouseLeave = useCallback(() => {
    if (dragging === -1) setActiveIndex(-1)
  }, [dragging])

  return (
    <div className="flex flex-col gap-4 p-4 min-h-screen bg-black text-white">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">DSP Demo Mode</h1>
        <div className="flex items-center gap-2">
          <Toggle pressed={powered} onPressedChange={setPowered} size="sm">
            {powered ? 'Powered On' : 'Powered Off'}
          </Toggle>
          <Button variant="outline" size="sm" onClick={() => setFilters(customPreset)}>
            Reset Preset
          </Button>
        </div>
      </div>

      <DspPanel
        powered={powered}
        filters={filters}
        activeIndex={activeIndex}
        dragging={dragging}
        handleFilterChange={handleFilterChange}
        handleMouseEnter={handleMouseEnter}
        handleMouseLeave={handleMouseLeave}
        setDragging={setDragging}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2 text-zinc-100">Master Volume</h3>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-primary w-3/4" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2 text-zinc-100">Input Gain</h3>
            <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 w-1/2" />
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardContent className="p-4">
            <h3 className="font-medium mb-2 text-zinc-100">System Status</h3>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Connected
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
