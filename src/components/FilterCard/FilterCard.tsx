import clsx from 'clsx'
import {
  getZeroFreq,
  getZeroGain,
  getZeroQ,
  type FilterChangeEvent,
  type FilterType,
  type GraphFilter
} from 'dsssp'
import { useEffect, useMemo, useState } from 'react'
import tailwindColors from 'tailwindcss/colors'

import filterColors from '../../configs/colors'
import type { EqRangeConfig } from '../../configs/parameterRanges'
import scale from '../../configs/scale'

import { FilterInput, FilterSelect, SliderInput } from '.'
import { generateNoise } from './utils'

const FilterCard = ({
  index = -1,
  active,
  filter,
  allowedTypes,
  disabled,
  eqRange,
  onEnter,
  onLeave,
  onChange
}: {
  index: number
  active: boolean
  filter: GraphFilter
  allowedTypes?: FilterType[] | null
  disabled: boolean
  eqRange?: EqRangeConfig
  onLeave?: () => void
  onEnter?: (event: FilterChangeEvent) => void
  onChange: (event: FilterChangeEvent) => void
}) => {
  const fallbackEqRange = {
    freq: { min: scale.minFreq, max: scale.maxFreq, step: 1 },
    gain: { min: scale.minGain, max: scale.maxGain, step: Math.pow(10, -(scale.gainPrecision ?? 1)) },
    q: { min: scale.minQ, max: scale.maxQ, step: Math.pow(10, -(scale.qPrecision ?? 1)) }
  }
  const resolvedEqRange = eqRange ?? fallbackEqRange
  const stepPrecision = (step: number, fallbackPrecision: number) => {
    if (!Number.isFinite(step) || step <= 0) return fallbackPrecision
    const [, decimals = ''] = String(step).split('.')
    return decimals.length
  }
  const resolvedFreqPrecision = stepPrecision(resolvedEqRange.freq.step, 0)
  const resolvedGainPrecision = stepPrecision(resolvedEqRange.gain.step, scale.gainPrecision ?? 1)
  const resolvedQPrecision = stepPrecision(resolvedEqRange.q.step, scale.qPrecision ?? 1)
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
        'flex flex-col flex-1 gap-1 items-center shadow-sm border rounded-sm px-1 py-2 text-center transition-colors duration-200 bg-zinc-900 overflow-hidden',
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
        allowedTypes={allowedTypes}
        disabled={disabled}
        onChange={(type) => onChange({ ...filter, index, type, ended: true })}
      />

      <FilterInput
        min={resolvedEqRange.freq.min}
        max={resolvedEqRange.freq.max}
        step={resolvedEqRange.freq.step}
        precision={resolvedFreqPrecision}
        label="Freq"
        value={filter.freq}
        disabled={disabled || zeroFreq}
        onChange={(freq) => onChange({ ...filter, index, freq, ended: true })}
      />

      <div className="flex flex-row gap-1 w-full">
        <SliderInput
          max={resolvedEqRange.gain.max}
          min={resolvedEqRange.gain.min}
          step={resolvedEqRange.gain.step}
          precision={resolvedGainPrecision}
          className="flex-1"
          label="Gain"
          value={filter.gain}
          disabled={disabled || zeroGain}
          onChange={(gain, ended) =>
            onChange({ ...filter, index, gain, ended })
          }
        />

        <SliderInput
          log
          max={resolvedEqRange.q.max}
          min={resolvedEqRange.q.min}
          step={resolvedEqRange.q.step}
          precision={resolvedQPrecision}
          className="flex-1"
          label="Q"
          value={filter.q}
          disabled={disabled || zeroQ}
          onChange={(q, ended) => onChange({ ...filter, index, q, ended })}
        />
      </div>
    </div>
  )
}

export default FilterCard
