import {
  FrequencyResponseGraph,
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  type FilterChangeEvent,
  FilterPoint,
  PointerTracker,
  FrequencyResponseCurve
} from 'dsssp'
import { Fragment, useEffect, useRef, useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import styles from './DemoMode.module.css'
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
  filters: typeof customPreset
  activeIndex: number
  dragging: boolean
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
  const graphContainerRef = useRef<HTMLDivElement | null>(null)
  const [graphWidth, setGraphWidth] = useState(0)

  useEffect(() => {
    const element = graphContainerRef.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = Math.floor(element.getBoundingClientRect().width)
      setGraphWidth((prevWidth) =>
        prevWidth === nextWidth ? prevWidth : nextWidth
      )
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
          <Button variant="secondary">Reset</Button>
          <Toggle aria-label="Bypass" variant="outline">
            Bypass
          </Toggle>
        </div>
        <div
          ref={graphContainerRef}
          className="shadow-sm shadow-black relative w-full"
        >
          {graphWidth > 0 && (
            <FrequencyResponseGraph
              width={graphWidth}
              height={360}
              theme={theme}
              scale={scale}
            >
              {powered ? (
                <>
                  {filters.map((filter, index) => (
                    <Fragment key={index}>
                      <FilterGradient
                        fill={true}
                        index={index}
                        filter={filter}
                        id={`filter-${index}`}
                      />

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
                      // label={getLabel(index)}
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
                <FrequencyResponseCurve
                  dotted
                  magnitudes={[]}
                  color={tailwindColors.slate[500]}
                />
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

function DemoMode() {
  const [powered] = useState(true)
  const [filters, setFilters] = useState(customPreset)

  const [dragging, setDragging] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const handleFilterChange = (filterEvent: FilterChangeEvent) => {
    const { index, ...filter } = filterEvent

    setFilters((prevFilters) => {
      const newFilters = [...prevFilters]
      newFilters[index] = { ...newFilters[index], ...filter }
      return newFilters
    })
  }

  const handleMouseLeave = () => {
    if (!dragging) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!dragging) setActiveIndex(index)
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
              powered={powered}
              filters={filters}
              activeIndex={activeIndex}
              dragging={dragging}
              handleFilterChange={handleFilterChange}
              handleMouseEnter={handleMouseEnter}
              handleMouseLeave={handleMouseLeave}
              setDragging={setDragging}
            />
          </TabsContent>
          <TabsContent value="mic">
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
          </TabsContent>
          <TabsContent value="reverb">
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
          </TabsContent>
          <TabsContent value="echo">
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
          </TabsContent>
          <TabsContent value="mainoutput">
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
          </TabsContent>
          <TabsContent value="suboutput">
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
          </TabsContent>
          <TabsContent value="center">
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
          </TabsContent>
          <TabsContent value="surround">
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
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default DemoMode
