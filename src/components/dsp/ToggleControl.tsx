import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'

import { Label } from '@/components/ui/label'
import { Toggle } from '@/components/ui/toggle'

export type ToggleControlProps = {
  label: string
  pressed?: boolean | null
  disabled?: boolean
  onChange: (pressed: boolean) => void
}

export function ToggleControl({ label, pressed, disabled, onChange }: ToggleControlProps) {
  const { t } = useTranslation()
  const isPressed = !!pressed
  const translatedLabel = t(`uiText.${uiTextKey(label)}`, { defaultValue: label })

  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{translatedLabel}</Label>
      <Toggle
        aria-label={translatedLabel}
        variant="outline"
        pressed={isPressed}
        onPressedChange={onChange}
        disabled={disabled}
        className="px-2"
      >
        {isPressed
          ? t(`uiText.${uiTextKey('On')}`, { defaultValue: 'On' })
          : t(`uiText.${uiTextKey('Off')}`, { defaultValue: 'Off' })}
      </Toggle>
    </div>
  )
}
