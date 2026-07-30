import type { CSSProperties, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'
import { clampNumber, PreciseValueButton } from './PreciseValueButton'

import { AbstractlySlider } from '@/components/AbstractlySlider'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

export type NumberControlProps = {
  label: string
  value?: number | null
  step?: number
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  onChange: (value: number) => void
  extra?: ReactNode
}

export function NumberControl({
  label,
  value,
  step = 1,
  min,
  max,
  disabled,
  className,
  onChange,
  extra,
}: NumberControlProps) {
  const { t } = useTranslation()
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })
  const sliderMin = min ?? 0
  const sliderMax = max ?? 100
  const hasValue = typeof value === 'number' && Number.isFinite(value)
  const currentValue = hasValue ? clampNumber(value, sliderMin, sliderMax) : sliderMin

  return (
    <div className={cn('flex items-end gap-2', className)}>
      <div className="min-w-0 flex-1 flex flex-col gap-1">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-muted-foreground font-medium">{translatedLabel}</Label>
          <PreciseValueButton
            label={translatedLabel}
            value={currentValue}
            hasValue={hasValue}
            min={sliderMin}
            max={sliderMax}
            step={step}
            disabled={disabled}
            onCommit={onChange}
          />
        </div>
        <AbstractlySlider
          orientation="horizontal"
          value={currentValue}
          min={sliderMin}
          max={sliderMax}
          step={step}
          disabled={disabled}
          showLed={false}
          className="ab-slider--no-shell ab-slider--dark"
          aria-label={translatedLabel}
          onChange={onChange}
          style={
            {
              '--ab-slider-width': '100%',
              '--ab-slider-min-height': '34px',
              '--ab-slider-innerplate-width': '100%',
              '--ab-slider-innerplate-min-height': '32px',
              '--ab-slider-innerplate-padding-y': '10px',
              '--ab-slider-track-width': '100%',
              '--ab-slider-track-height': '6px',
              '--ab-slider-handle-width': '54px',
              '--ab-slider-handle-height': '25px',
              '--ab-slider-handle-offset-y': '-10px',
            } as CSSProperties
          }
        />
      </div>
      {extra && <div className="pb-[5px]">{extra}</div>}
    </div>
  )
}
