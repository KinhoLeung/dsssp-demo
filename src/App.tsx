import {
  FrequencyResponseGraph,
  CompositeCurve,
  FilterCurve,
  FilterGradient,
  type FilterChangeEvent,
  FilterPoint,
  PointerTracker,
  type GraphFilter,
  type BiQuadCoefficients,
  calcFilterCoefficients,
  FrequencyResponseCurve
} from 'dsssp'
import { useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import styles from './App.module.css'
import { DevicePanel, FilterCard, Header } from './components'
import { customPreset } from './configs/presets'
import scale from './configs/scale'
import theme from './configs/theme'

function App() {
  const calcPresetCoefficients = (filters: GraphFilter[]) =>
    filters.map((filter) => {
      return calcFilterCoefficients(filter, scale.sampleRate)
    })

  const [powered, setPowered] = useState(true)
  const [altered, setAltered] = useState(false)
  const [filters, setFilters] = useState(customPreset)
  const [coefficients, setCoefficients] = useState<BiQuadCoefficients[]>(
    calcPresetCoefficients(customPreset)
  )

  const [dragging, setDragging] = useState(false)
  const [activeIndex, setActiveIndex] = useState<number>(-1)

  const handleFilterChange = (filterEvent: FilterChangeEvent) => {
    const { index, ended, ...filter } = filterEvent

    const clampedFreq =
      filter.freq !== undefined
        ? Math.min(Math.max(filter.freq, scale.minFreq), scale.maxFreq)
        : filter.freq

    const clampedGain =
      filter.gain !== undefined
        ? Math.min(Math.max(filter.gain, scale.minGain), scale.maxGain)
        : filter.gain

    const clampedQ =
      filter.q !== undefined
        ? Math.min(Math.max(filter.q, scale.minQ), scale.maxQ)
        : filter.q

    const nextFilter = {
      ...filter,
      freq: clampedFreq,
      gain: clampedGain,
      q: clampedQ
    }

    if (ended) {
      setCoefficients((prevCoefficients) => {
        const newCoefficients = [...prevCoefficients]
        newCoefficients[index] = calcFilterCoefficients(
          nextFilter,
          scale.sampleRate
        )
        return newCoefficients
      })
      setAltered(true)
    }

    setFilters((prevFilters) => {
      const newFilters = [...prevFilters]
      newFilters[index] = { ...newFilters[index], ...nextFilter }
      return newFilters
    })
  }

  const handleMouseLeave = () => {
    if (!dragging) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!dragging) setActiveIndex(index)
  }

  const handlePresetChange = (preset: GraphFilter[]) => {
    setAltered(false)
    setFilters(preset)
    setCoefficients(calcPresetCoefficients(preset))
  }

  return (
    <div className="text-white text-sans min-h-screen flex flex-col items-center">
      <div className="max-w-[1440px] pt-1 flex flex-col gap-1">
        <Header
          altered={altered}
          onPresetChange={handlePresetChange}
          onPowerChange={setPowered}
        />

        <DevicePanel
          filters={filters}
          coefficients={coefficients}
          sampleRate={scale.sampleRate}
        />

        <div className="shadow-sm shadow-black relative">
          <FrequencyResponseGraph
            width={1440}
            height={420}
            theme={theme}
            scale={scale}
          >
            {powered ? (
              <>
                {filters.map((filter, index) => (
                  <>
                    <FilterGradient
                      fill={true}
                      key={index}
                      index={index}
                      filter={filter}
                      id={`filter-${index}`}
                    />

                    <FilterCurve
                      showPin
                      key={index}
                      index={index}
                      filter={filter}
                      active={activeIndex === index}
                      gradientId={`filter-${index}`}
                    />
                  </>
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

          <div className={styles.glareOverlay}></div>
        </div>

        <div className="flex gap-1 w-full pb-1">
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
      </div>
    </div>
  )
}

export default App
