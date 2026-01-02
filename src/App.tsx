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
import { useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import styles from './App.module.css'
import { FilterCard } from './components'
import { customPreset } from './configs/presets'
import scale from './configs/scale'
import theme from './configs/theme'

function App() {
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
        <div className="shadow-sm shadow-black relative">
          <FrequencyResponseGraph
            width={840}
            height={360}
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
