import clsx from 'clsx'
import {
  getZeroFreq,
  getZeroGain,
  getZeroQ,
  type FilterChangeEvent,
  type GraphFilter
} from 'dsssp'
import { useEffect, useMemo, useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import filterColors from '../../configs/colors'
import scale from '../../configs/scale'

import { FilterInput, FilterSelect, SliderInput } from '.'
import { generateNoise } from './utils'

const FilterCard = ({
  index = -1,
  active,
  filter,
  disabled,
  onEnter,
  onLeave,
  onChange,
  lockType,
  isFirst,
  isLast
}: {
  index: number
  active: boolean
  filter: GraphFilter
  disabled: boolean
  lockType?: boolean
  isFirst?: boolean
  isLast?: boolean
  onLeave?: () => void
  onEnter?: (event: FilterChangeEvent) => void
  onChange: (event: FilterChangeEvent) => void
}) => {
  const {
    minFreq,
    maxFreq,
    minGain,
    maxGain,
    minQ,
    maxQ,
    gainPrecision = 1,
    qPrecision = 1
  } = scale
  const [noiseDataUrl, setNoiseDataUrl] = useState<string>('')
  // eslint-disable-next-line no-param-reassign
  if (disabled) filter = { type: 'BYPASS', freq: 0, gain: 0, q: 1 }
  const { type } = filter

  const zeroFreq = useMemo(() => getZeroFreq(type), [type])
  const zeroGain = useMemo(() => getZeroGain(type), [type])
  const zeroQ = useMemo(() => getZeroQ(type), [type])

  const color =
    type === 'BYPASS'
      ? tailwindColors.slate[400]
      : filterColors[index].active || '#FFFFFF'

  useEffect(() => {
    const noise = generateNoise(50, 50, 0.1)
    setNoiseDataUrl(noise)
  }, [])

  return (
    <div
      onMouseEnter={() => onEnter?.({ ...filter, index })}
      onMouseLeave={onLeave}
      className={clsx(
        'flex flex-col flex-1 gap-2 items-center shadow-sm border rounded-sm p-2 text-center transition-colors duration-200 bg-zinc-900 overflow-hidden',
        active && !disabled ? ' border-zinc-600' : ' border-zinc-800'
      )}
      style={{
        backgroundImage: `url(${noiseDataUrl})`,
        backgroundRepeat: 'repeat',
        backgroundBlendMode: 'overlay'
      }}
    >
      <FilterSelect
        color={color}
        filter={filter}
        disabled={disabled}
        locked={lockType}
        isFirst={isFirst}
        isLast={isLast}
        onChange={(type) => onChange({ ...filter, index, type, ended: true })}
      />

      <FilterInput
        suffix="Hz"
        min={minFreq}
        max={maxFreq}
        precision={0}
        label="Frequency"
        value={filter.freq}
        disabled={disabled || zeroFreq}
        onChange={(freq) => onChange({ ...filter, index, freq, ended: true })}
      />

      <div className="flex flex-row gap-2 w-full">
        <SliderInput
          max={maxGain}
          min={minGain}
          step={0.1}
          label="Gain"
          value={filter.gain}
          precision={gainPrecision}
          disabled={disabled || zeroGain}
          onChange={(gain, ended) =>
            onChange({ ...filter, index, gain, ended })
          }
        />

        <SliderInput
          log
          max={maxQ}
          min={minQ}
          step={0.1}
          label="Q"
          value={filter.q}
          precision={qPrecision}
          disabled={disabled || zeroQ}
          onChange={(q, ended) => onChange({ ...filter, index, q, ended })}
        />
      </div>
    </div>
  )
}

export default FilterCard
