import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  NumberField,
  NumberFieldDecrementTrigger,
  NumberFieldGroup,
  NumberFieldIncrementTrigger,
  NumberFieldInput,
} from '@/components/ui/number-field'

export const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value))

const MAX_STEP_DECIMALS = 6

export const getStepDecimals = (step: number) => {
  if (!Number.isFinite(step) || step <= 0) return 0

  const absStep = Math.abs(step)
  const tolerance = Math.max(Number.EPSILON * 100, absStep * 1e-6)

  for (let decimals = 0; decimals <= MAX_STEP_DECIMALS; decimals += 1) {
    const rounded = Number(absStep.toFixed(decimals))
    if (Math.abs(rounded - absStep) <= tolerance) return decimals
  }

  return MAX_STEP_DECIMALS
}

export const snapToStep = (value: number, min: number, max: number, step: number) => {
  const safeStep = Number.isFinite(step) && step > 0 ? step : 1
  const decimals = getStepDecimals(safeStep)
  const snapped = Math.round((value - min) / safeStep) * safeStep + min
  return clampNumber(Number(snapped.toFixed(decimals)), min, max)
}

export const formatSliderValue = (value: number, step: number) =>
  value.toFixed(getStepDecimals(step))

export type PreciseValueButtonProps = {
  label: string
  value: number
  hasValue: boolean
  min: number
  max: number
  step: number
  disabled?: boolean
  onCommit: (value: number) => void
}

export function PreciseValueButton({
  label,
  value,
  hasValue,
  min,
  max,
  step,
  disabled,
  onCommit,
}: PreciseValueButtonProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState<number | undefined>(() => value)

  useEffect(() => {
    if (!open) setDraftValue(value)
  }, [open, value])

  const handleDraftValueChange = (nextValue: number | undefined) => {
    setDraftValue(nextValue)
    if (nextValue === undefined) return
    onCommit(snapToStep(nextValue, min, max, step))
  }

  return (
    <>
      <button
        type="button"
        className="rounded px-1 text-xs font-semibold tabular-nums text-white outline-none transition-colors hover:bg-white/10 focus-visible:bg-white/10 focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
        disabled={disabled || !hasValue}
        onClick={() => setOpen(true)}
      >
        {hasValue ? formatSliderValue(value, step) : '-'}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <NumberField
              value={draftValue}
              onValueChange={handleDraftValueChange}
              min={min}
              max={max}
              step={step}
            >
              <NumberFieldGroup>
                <NumberFieldDecrementTrigger />
                <NumberFieldInput
                  autoFocus
                  inputMode={step < 1 ? 'decimal' : 'numeric'}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return
                    event.preventDefault()
                    setOpen(false)
                  }}
                />
                <NumberFieldIncrementTrigger />
              </NumberFieldGroup>
            </NumberField>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t(`uiText.${uiTextKey('Close')}`, { defaultValue: 'Close' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
