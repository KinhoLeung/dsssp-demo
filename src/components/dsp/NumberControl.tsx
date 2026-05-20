import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'

import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
  NumberFieldLabel,
} from '@/components/ui/number-field'
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

  return (
    <div className={cn('flex items-end gap-1', className)}>
      <NumberField
        value={value ?? undefined}
        onValueChange={(next) => {
          if (typeof next !== 'number' || Number.isNaN(next)) return
          onChange(next)
        }}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        className="flex-1 gap-1"
      >
        <NumberFieldLabel className="text-xs text-muted-foreground">{translatedLabel}</NumberFieldLabel>
        <NumberFieldGroup>
          <NumberFieldDecrementTrigger />
          <NumberFieldInput className="text-sm tabular-nums" />
          <NumberFieldIncrementTrigger />
        </NumberFieldGroup>
      </NumberField>
      {extra && <div className="mb-[1px]">{extra}</div>}
    </div>
  )
}
