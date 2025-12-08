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
import SliderInput from './components/FilterCard/SliderInput'
import { customPreset } from './configs/presets'
import scale from './configs/scale'
import theme from './configs/theme'

const enforceEdgeTypes = (filters: GraphFilter[]) =>
  filters.map((filter, index, arr) => {
    if (index === 0) return { ...filter, type: 'HIGHPASS2' }
    if (index === arr.length - 1) return { ...filter, type: 'LOWPASS2' }
    return filter
  })

const defaultGainFilter: GraphFilter = { freq: 0, gain: 0, q: 0, type: 'GAIN' }

function App() {
  const calcPresetCoefficients = (filters: GraphFilter[]) =>
    filters.map((filter) => {
      return calcFilterCoefficients(filter, scale.sampleRate)
    })

  const [powered, setPowered] = useState(true)
  const [altered, setAltered] = useState(false)
  const [gainFilter, setGainFilter] = useState<GraphFilter>(
    () => ({ ...defaultGainFilter })
  )
  const [filters, setFilters] = useState<GraphFilter[]>(() =>
    enforceEdgeTypes(customPreset)
  )
  const [coefficients, setCoefficients] = useState<BiQuadCoefficients[]>(() =>
    calcPresetCoefficients([...enforceEdgeTypes(customPreset), defaultGainFilter])
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

    setFilters((prevFilters) => {
      const newFilters = [...prevFilters]
      const typeLocked = index === 0 || index === prevFilters.length - 1
      const safePatch = { ...nextFilter }
      if (typeLocked) delete safePatch.type
      newFilters[index] = { ...newFilters[index], ...safePatch }
      const enforcedFilters = enforceEdgeTypes(newFilters)

      if (ended) {
        setCoefficients(
          calcPresetCoefficients([...enforcedFilters, gainFilter])
        )
      }

      return enforcedFilters
    })

    if (ended) setAltered(true)
  }

  const handleMouseLeave = () => {
    if (!dragging) setActiveIndex(-1)
  }

  const handleMouseEnter = ({ index }: { index: number }) => {
    if (!dragging) setActiveIndex(index)
  }

  const handlePresetChange = (preset: GraphFilter[]) => {
    setAltered(false)
    const enforcedPreset = enforceEdgeTypes(preset)
    const gainReset = { ...defaultGainFilter }
    setFilters(enforcedPreset)
    setGainFilter(gainReset)
    setCoefficients(calcPresetCoefficients([...enforcedPreset, gainReset]))
  }

  const handleGainChange = (gain: number, ended: boolean) => {
    const clampedGain = Math.min(Math.max(gain, scale.minGain), scale.maxGain)
    const nextGainFilter = { ...gainFilter, gain: clampedGain }
    setGainFilter(nextGainFilter)

    if (ended) {
      setCoefficients(calcPresetCoefficients([...filters, nextGainFilter]))
      setAltered(true)
    }
  }

  const filtersWithGain = [...filters, gainFilter]
  const lastIndex = filters.length - 1

  return (
    <div className="text-white text-sans min-h-screen flex flex-col items-center">
      <div className="max-w-[1440px] pt-1 flex flex-col gap-1">
        <Header
          altered={altered}
          onPresetChange={handlePresetChange}
          onPowerChange={setPowered}
        />

        <DevicePanel
          filters={filtersWithGain}
          coefficients={coefficients}
          sampleRate={scale.sampleRate}
        />

        <div className="shadow-sm shadow-black relative flex bg-zinc-950 border border-zinc-900 rounded-sm overflow-hidden">
          <div className="relative">
            <FrequencyResponseGraph
              width={1320}
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
                  <CompositeCurve filters={filtersWithGain} />
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

          <div className="flex items-center px-3 bg-zinc-900/60 border-l border-zinc-800">
            <div className="w-[88px]">
              <SliderInput
                label="Gain"
                min={scale.minGain}
                max={scale.maxGain}
                step={0.1}
                height={260}
                value={gainFilter.gain}
                onChange={handleGainChange}
                centerLabel
              />
            </div>
          </div>
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
              lockType={index === 0 || index === lastIndex}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default App
