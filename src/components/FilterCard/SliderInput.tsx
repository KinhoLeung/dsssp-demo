import clsx from 'clsx'
import { useEffect, useRef } from 'react'

import { AbstractlySlider } from '../AbstractlySlider'

import { FilterInput } from '.'

const SliderInput = ({
  value,
  onChange,
  min = 0.1,
  max = 100,
  step = 1,
  height = 96,
  label,
  log = false,
  disabled,
  focusColor,
  precision = 2,
  className
}: {
  value: number
  onChange: (value: number, ended: boolean) => void
  min?: number
  max?: number
  step?: number
  height?: number
  label?: string
  log?: boolean
  disabled?: boolean
  focusColor?: string
  precision?: number
  className?: string
}) => {
  const dragging = useRef(false)
  const dragStartValue = useRef(value)
  const lastValue = useRef(value)
  const wheelTargetRef = useRef<HTMLDivElement | null>(null)
  const latestRef = useRef({
    value,
    min,
    max,
    step,
    precision,
    disabled,
    onChange
  })

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

  const sliderMin = log ? 0 : min
  const sliderMax = log ? 100 : max
  const sliderValue = log ? Number(logToLinear(value).toFixed(precision)) : value
  const sliderStep = step

  const commitEndIfChanged = () => {
    if (!dragging.current) return
    dragging.current = false
    if (dragStartValue.current !== lastValue.current) {
      onChange(lastValue.current, true)
    }
  }

  useEffect(() => {
    latestRef.current = {
      value,
      min,
      max,
      step,
      precision,
      disabled,
      onChange
    }
  }, [value, min, max, step, precision, disabled, onChange])

  useEffect(() => {
    const element = wheelTargetRef.current
    if (!element) return
    const handleWheel = (event: WheelEvent) => {
      const latest = latestRef.current
      if (latest.disabled) return
      event.preventDefault()
      const direction = event.deltaY < 0 ? 1 : -1
      const next = Math.min(
        Math.max(latest.value + direction * latest.step, latest.min),
        latest.max
      )
      const roundedNext = Number(next.toFixed(latest.precision))
      latest.onChange(roundedNext, true)
    }
    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  const handlePointerDownCapture = () => {
    if (disabled) return
    dragging.current = true
    dragStartValue.current = value
    lastValue.current = value
  }

  return (
    <div className={clsx('flex-1 min-w-0', className)}>
      {label && (
        <div
          className={clsx(
            'pb-1 text-sm font-semibold text-zinc-600 drop-shadow-lg transition-opacity duration-150 dark:text-zinc-500',
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
          ref={wheelTargetRef}
          onPointerDownCapture={handlePointerDownCapture}
          onPointerUp={commitEndIfChanged}
          onPointerCancel={commitEndIfChanged}
        >
          <AbstractlySlider
            value={sliderValue}
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            disabled={disabled}
            showLed={false}
            className="ab-slider--no-shell ab-slider--dark"
            aria-label={label ?? 'Slider'}
            onChange={(nextSliderValue) => {
              const nextValue = log
                ? Number(linearToLog(nextSliderValue).toFixed(precision))
                : nextSliderValue
              lastValue.current = nextValue
              onChange(nextValue, false)
            }}
            style={
              {
                '--ab-slider-min-height': '0px',
                '--ab-slider-innerplate-min-height': '0px',
                '--ab-slider-innerplate-margin-top': '0px',
                '--ab-slider-innerplate-padding-y': '10px',
                '--ab-slider-track-margin-y': '10px',
                '--ab-slider-track-height': `${Math.max(height, 165)}px`,
                ...(focusColor ? { '--ab-slider-focus': focusColor } : null)
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
          step={step}
          precision={precision}
          disabled={disabled}
          onChange={(value) => onChange(value, true)}
        />
      </div>
    </div>
  )
}

export default SliderInput
