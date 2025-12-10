import clsx from 'clsx'
import type React from 'react'
import { useRef } from 'react'
import tailwindColors from 'tailwindcss/colors'

import { FilterInput } from '.'
import styles from './SliderInput.module.css'

const SliderInput = ({
  value,
  onChange,
  min = 0.1,
  max = 100,
  step = 1,
  height = 96,
  label,
  log = false,
  precision = 1,
  disabled,
  centerLabel = false
}: {
  value: number
  onChange: (value: number, ended: boolean) => void
  min?: number
  max?: number
  step?: number
  height?: number
  label?: string
  log?: boolean
  precision?: number
  disabled?: boolean
  centerLabel?: boolean
}) => {
  const dragging = useRef(false)
  const oldValue = useRef(value)

  const linearToLog = (linear: number): number => {
    const minv = Math.log(min)
    const maxv = Math.log(max)
    const scale = (maxv - minv) / 100
    return Math.exp(minv + scale * linear)
  }

  const logToLinear = (log: number): number => {
    const minv = Math.log(min)
    const maxv = Math.log(max)
    const scale = (maxv - minv) / 100
    return (Math.log(log) - minv) / scale
  }

  const getNewValue = (
    event:
      | React.ChangeEvent<HTMLInputElement>
      | React.MouseEvent<HTMLInputElement>
      | React.TouchEvent<HTMLInputElement>
  ): number => {
    const target = event.target as HTMLInputElement
    let newValue = Number(target.value)
    if (log) newValue = Number(linearToLog(newValue).toFixed(precision))
    return newValue
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = getNewValue(e)
    onChange(newValue, false)
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLInputElement>) => {
    if (!dragging.current) return
    dragging.current = false
    const newValue = getNewValue(e)
    if (oldValue.current !== newValue) onChange(newValue, true)
  }

  const handleTouchEnd = (e: React.TouchEvent<HTMLInputElement>) => {
    if (!dragging.current) return
    dragging.current = false
    const newValue = getNewValue(e)
    if (oldValue.current !== newValue) onChange(newValue, true)
  }

  const handleMouseDown = () => {
    dragging.current = true
    oldValue.current = value
  }

  const handleTouchStart = () => {
    dragging.current = true
    oldValue.current = value
  }

  const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
    if (disabled) return
    e.preventDefault()

    const direction = e.deltaY > 0 ? -1 : 1
    const stepMultiplier = e.shiftKey ? 10 : 1

    let nextValue = value + step * stepMultiplier * direction
    nextValue = Math.min(max, Math.max(min, nextValue))
    nextValue = Number(nextValue.toFixed(precision))

    if (nextValue !== value) onChange(nextValue, true)
  }

  const sliderValue = log ? logToLinear(value).toFixed(precision) : value

  const calcPercentage = () => {
    if (log) {
      const logMin = Math.log(min)
      const logMax = Math.log(max)
      return ((Math.log(value) - logMin) / (logMax - logMin)) * 100
    } else {
      return ((Number(sliderValue) - min) / (max - min)) * 100
    }
  }

  const percentage = calcPercentage()

  const zeroPercentage = ((0 - min) / (max - min)) * 100

  const fillStart = percentage < zeroPercentage ? percentage : zeroPercentage
  const fillEnd = percentage < zeroPercentage ? zeroPercentage : percentage
  // const fillColor = disabled ? tailwindColors.black : tailwindColors.cyan[700]
  const fillColor = disabled
    ? tailwindColors.black
    : log
      ? tailwindColors.cyan[700]
      : value > 0
        ? tailwindColors.amber[800]
        : tailwindColors.lime[700]

  return (
    <div>
      {label && (
        <div
          className={clsx(
            'pb-1 text-sm font-semibold text-zinc-500 drop-shadow-lg transition-opacity duration-150',
            { 'text-center': centerLabel },
            { 'opacity-50 pointer-events-none': disabled }
          )}
        >
          {label}
        </div>
      )}
      <div className="py-1 w-full rounded-sm">
        <div
          className={clsx(
            'mx-auto flex items-center justify-center transition-opacity duration-150',
            {
              'opacity-50 pointer-events-none': disabled
            }
          )}
          style={{ height, width: '38px' }}
        >
          <input
            type="range"
            min={log ? 0 : min}
            max={log ? 100 : max}
            step={step}
            value={sliderValue}
            onChange={handleChange}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            className={styles.slider}
            style={
              {
                width: height,
                '--fill-color': fillColor,
                '--fill-start': `${fillStart}%`,
                '--fill-end': `${fillEnd}%`
              } as React.CSSProperties
            }
          />
        </div>
      </div>
      <div className="pt-1">
        <FilterInput
          value={value}
          min={min}
          max={max}
          precision={precision}
          disabled={disabled}
          onChange={(value) => onChange(value, true)}
        />
      </div>
    </div>
  )
}

export default SliderInput
