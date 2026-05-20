import { useTranslation } from 'react-i18next'

import { uiTextKey, type SelectOption } from './dspUtils'

import { Label } from '@/components/ui/label'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type ToggleGroupControlProps = {
  label: string
  value?: string
  options: SelectOption[]
  disabled?: boolean
  onChange: (value: string) => void
}

export function ToggleGroupControl({ label, value, options, disabled, onChange }: ToggleGroupControlProps) {
  const { t } = useTranslation()
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{translatedLabel}</Label>
      <ToggleGroup
        type="single"
        variant="outline"
        value={value}
        onValueChange={(next) => {
          if (next) onChange(next)
        }}
        disabled={disabled}
        className="flex flex-wrap justify-start"
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {t(`uiText.${uiTextKey(option.label)}`, { defaultValue: option.label })}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}
