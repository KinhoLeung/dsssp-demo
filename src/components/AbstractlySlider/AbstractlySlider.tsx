import React from 'react'

import { AbstractlySliderHandleBg } from './AbstractlySliderHandleBg'
import { AbstractlySliderHorizontalHandleBg } from './AbstractlySliderHorizontalHandleBg'
import './AbstractlySlider.css'

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function getStepDecimals(step: number) {
  const stepString = String(step)
  if (!stepString.includes('.')) return 0
  const [, decimals] = stepString.split('.')
  return decimals.length
}

type SnapToStepOptions = {
  min: number
  max: number
  step: number
}

function snapToStep(value: number, { min, max, step }: SnapToStepOptions) {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const decimals = getStepDecimals(safeStep)
  const snapped = Math.round((value - min) / safeStep) * safeStep + min
  const fixed = Number(snapped.toFixed(decimals))
  return clamp(fixed, min, max)
}

type Rgb = { r: number; g: number; b: number }

function tryParseHexColor(input: string): Rgb | null {
  const value = input.trim()
  if (!value.startsWith('#')) return null

  const hex = value.slice(1)
  if (![3, 4, 6, 8].includes(hex.length)) return null

  const normalized =
    hex.length === 3 || hex.length === 4
      ? hex
          .slice(0, 3)
          .split('')
          .map((c) => c + c)
          .join('')
      : hex.slice(0, 6)

  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return null
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return { r, g, b }
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const clamped = clamp(t, 0, 1)
  return {
    r: Math.round(a.r + (b.r - a.r) * clamped),
    g: Math.round(a.g + (b.g - a.g) * clamped),
    b: Math.round(a.b + (b.b - a.b) * clamped),
  }
}

type LedStyleVars = {
  '--ab-slider-led-on-bg': string
  '--ab-slider-led-on-shadow': string
}

function getLedStyleVars(ledColor: string | undefined): LedStyleVars | null {
  if (typeof ledColor !== 'string' || !ledColor.trim()) return null

  const rgb = tryParseHexColor(ledColor)
  if (!rgb) {
    return {
      '--ab-slider-led-on-bg': `radial-gradient(at 50% 127%, ${ledColor} 28%, ${ledColor} 100%)`,
      '--ab-slider-led-on-shadow': `0 0 14px 0 ${ledColor}`,
    }
  }

  const highlight = mixRgb(rgb, { r: 255, g: 255, b: 255 }, 0.55)
  const glow = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.45)`
  return {
    '--ab-slider-led-on-bg': `radial-gradient(at 50% 127%, rgb(${highlight.r}, ${highlight.g}, ${highlight.b}) 28%, rgb(${rgb.r}, ${rgb.g}, ${rgb.b}) 100%)`,
    '--ab-slider-led-on-shadow': `0 0 14px 0 ${glow}`,
  }
}

export type AbstractlySliderProps = {
  value?: number
  defaultValue?: number
  min?: number
  max?: number
  step?: number
  onChange?: (nextValue: number) => void
  orientation?: 'vertical' | 'horizontal'
  ledOpacity?: number
  showLed?: boolean
  ledColor?: string
  theme?: 'auto' | 'light' | 'dark'
  disabled?: boolean
  className?: string
  style?: React.CSSProperties
  'aria-label'?: string
}

export function AbstractlySlider({
  value,
  defaultValue = 0,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  orientation = 'vertical',
  ledOpacity,
  showLed = true,
  ledColor,
  theme = 'auto',
  'aria-label': ariaLabel = 'Slider',
  disabled = false,
  className,
  style,
}: AbstractlySliderProps) {
  const isControlled = value != null

  const [uncontrolledValue, setUncontrolledValue] = React.useState(() =>
    snapToStep(clamp(defaultValue, min, max), { min, max, step })
  )

  React.useEffect(() => {
    if (isControlled) return
    const next = snapToStep(clamp(uncontrolledValue, min, max), { min, max, step })
    if (next !== uncontrolledValue) setUncontrolledValue(next)
  }, [isControlled, min, max, step, uncontrolledValue])

  const rawValue = value ?? uncontrolledValue
  const currentValue = snapToStep(clamp(rawValue, min, max), { min, max, step })

  const currentValueRef = React.useRef(currentValue)
  React.useEffect(() => {
    currentValueRef.current = currentValue
  }, [currentValue])

  const fraction = max === min ? 0 : (currentValue - min) / (max - min)
  const computedLedOpacity = clamp(ledOpacity != null ? ledOpacity : fraction, 0, 1)
  const isHorizontal = orientation === 'horizontal'

  const commitValue = React.useCallback(
    (nextValue: number) => {
      const next = snapToStep(clamp(nextValue, min, max), { min, max, step })
      if (next === currentValueRef.current) return
      if (!isControlled) setUncontrolledValue(next)
      onChange?.(next)
    },
    [isControlled, min, max, step, onChange]
  )

  const updateFromClientPosition = React.useCallback(
    (
      clientX: number,
      clientY: number,
      element: HTMLDivElement,
      pointerOffset = 0
    ) => {
      const rect = element.getBoundingClientRect()
      const handle = element.querySelector<HTMLElement>('.rangeslider__handle')
      const handleRect = handle?.getBoundingClientRect()
      const handleSize = isHorizontal ? (handleRect?.width ?? 0) : (handleRect?.height ?? 0)
      const halfHandle = handleSize / 2
      const minPosition = (isHorizontal ? rect.left : rect.top) + halfHandle
      const maxPosition = (isHorizontal ? rect.right : rect.bottom) - halfHandle
      const safeMinPosition = Math.min(minPosition, maxPosition)
      const safeMaxPosition = Math.max(minPosition, maxPosition)
      const clientPosition = isHorizontal ? clientX : clientY
      const adjustedPosition = clientPosition - pointerOffset
      const position = clamp(adjustedPosition, safeMinPosition, safeMaxPosition)
      const usableLength = safeMaxPosition - safeMinPosition
      const normalized =
        usableLength === 0
          ? 0
          : isHorizontal
            ? (position - safeMinPosition) / usableLength
            : 1 - (position - safeMinPosition) / usableLength
      const next = min + normalized * (max - min)
      commitValue(next)
    },
    [isHorizontal, min, max, commitValue]
  )

  const trackRef = React.useRef<HTMLDivElement | null>(null)
  const activePointerIdRef = React.useRef<number | null>(null)
  const pointerDownRef = React.useRef(false)
  const pointerOffsetRef = React.useRef(0)
  const [showFocusRing, setShowFocusRing] = React.useState(false)

  React.useEffect(() => {
    const element = trackRef.current
    if (!element) return

    const onWheel = (event: WheelEvent) => {
      if (disabled) return
      if (event.deltaY === 0) return

      event.preventDefault()

      const direction = event.deltaY < 0 ? 1 : -1
      const safeStep = Number.isFinite(step) && step > 0 ? step : 1
      const multiplier = event.shiftKey ? 10 : 1
      commitValue(currentValueRef.current + direction * safeStep * multiplier)
    }

    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [commitValue, disabled, step])

  const onPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (event.pointerType === 'mouse' && event.button !== 0) return
      event.preventDefault()

      pointerDownRef.current = true
      setShowFocusRing(false)

      const element = event.currentTarget
      try {
        element.focus({ preventScroll: true })
      } catch {
        if (typeof element.focus === 'function') element.focus()
      }

      activePointerIdRef.current = event.pointerId
      element.setPointerCapture(event.pointerId)

      pointerOffsetRef.current = 0
      const handle = element.querySelector<HTMLElement>('.rangeslider__handle')
      const targetNode = event.target instanceof Node ? event.target : null
      if (handle && targetNode && handle.contains(targetNode)) {
        const handleRect = handle.getBoundingClientRect()
        pointerOffsetRef.current = isHorizontal
          ? event.clientX - (handleRect.left + handleRect.width / 2)
          : event.clientY - (handleRect.top + handleRect.height / 2)
        return
      }

      updateFromClientPosition(event.clientX, event.clientY, element)
    },
    [disabled, isHorizontal, updateFromClientPosition]
  )

  const onFocus = React.useCallback(() => {
    if (disabled) return
    if (pointerDownRef.current) return
    setShowFocusRing(true)
  }, [disabled])

  const onBlur = React.useCallback(() => {
    pointerDownRef.current = false
    setShowFocusRing(false)
  }, [])

  const onPointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return
      if (activePointerIdRef.current == null) return
      if (event.pointerId !== activePointerIdRef.current) return
      event.preventDefault()
      updateFromClientPosition(
        event.clientX,
        event.clientY,
        event.currentTarget,
        pointerOffsetRef.current
      )
    },
    [disabled, updateFromClientPosition]
  )

  const onPointerUpOrCancel = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (activePointerIdRef.current == null) return
      if (event.pointerId !== activePointerIdRef.current) return
      activePointerIdRef.current = null
      pointerOffsetRef.current = 0

      try {
        event.currentTarget.releasePointerCapture(event.pointerId)
      } catch {
        // Ignore if capture was already released.
      }
    },
    []
  )

  const onKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled) return

      const safeStep = Number.isFinite(step) && step > 0 ? step : 1
      const bigStep = safeStep * 10

      let next = currentValueRef.current
      switch (event.key) {
        case 'ArrowUp':
        case 'ArrowRight':
          next += safeStep
          break
        case 'ArrowDown':
        case 'ArrowLeft':
          next -= safeStep
          break
        case 'PageUp':
          next += bigStep
          break
        case 'PageDown':
          next -= bigStep
          break
        case 'Home':
          next = min
          break
        case 'End':
          next = max
          break
        default:
          return
      }

      event.preventDefault()
      setShowFocusRing(true)
      commitValue(next)
    },
    [disabled, min, max, step, commitValue]
  )

  const themeClass =
    theme === 'dark'
      ? 'ab-slider--dark'
      : theme === 'light'
        ? 'ab-slider--light'
        : 'ab-slider--auto'

  const ledVars = React.useMemo(() => getLedStyleVars(ledColor), [ledColor])
  const mergedStyle = React.useMemo<React.CSSProperties | undefined>(() => {
    if (!ledVars) return style
    return { ...(style ?? {}), ...ledVars } as React.CSSProperties
  }, [ledVars, style])

  const rootClassName = ['ab-slider', `ab-slider--${orientation}`, themeClass, className]
    .filter((item): item is string => Boolean(item))
    .join(' ')

  return (
    <div className={rootClassName} style={mergedStyle}>
      {showLed ? (
        <div className="ab-slider-led-wrapper" aria-hidden="true">
          <div className="ab-slider-led-off" />
          <div
            className="ab-slider-led-on"
            style={{ opacity: computedLedOpacity }}
          />
        </div>
      ) : null}

      <div className="ab-slider-innerplate">
        <div
          className={[
            'rangeslider',
            isHorizontal ? 'rangeslider-horizontal' : 'rangeslider-vertical',
            showFocusRing ? 'ab-slider-focus-ring' : null,
          ]
            .filter(Boolean)
            .join(' ')}
          ref={trackRef}
          role="slider"
          aria-orientation={orientation}
          aria-label={ariaLabel}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={currentValue}
          aria-disabled={disabled ? 'true' : undefined}
          tabIndex={disabled ? -1 : 0}
          style={
            {
              '--ab-slider-fraction': String(fraction),
            } as React.CSSProperties
          }
          onFocus={onFocus}
          onBlur={onBlur}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUpOrCancel}
          onPointerCancel={onPointerUpOrCancel}
          onKeyDown={onKeyDown}
        >
          <div className="rangeslider__fill" />
          <div className="rangeslider__handle" aria-hidden="true">
            {isHorizontal ? (
              <AbstractlySliderHorizontalHandleBg />
            ) : (
              <AbstractlySliderHandleBg />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
