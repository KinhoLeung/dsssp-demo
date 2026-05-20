import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'

import { Toggle } from '@/components/ui/toggle'

export type PhaseInversionToggleProps = {
  pressed?: boolean | null
  disabled?: boolean
  onChange: (pressed: boolean) => void
}

export function PhaseInversionToggle({ pressed, disabled, onChange }: PhaseInversionToggleProps) {
  const { t } = useTranslation()
  const isPressed = !!pressed

  return (
    <Toggle
      aria-label={t(`uiText.${uiTextKey('Phase Inversion')}`, { defaultValue: 'Phase Inversion' })}
      variant="outline"
      pressed={isPressed}
      onPressedChange={onChange}
      disabled={disabled}
      className="h-9 w-9 p-0"
    >
      {isPressed ? '-' : '+'}
    </Toggle>
  )
}
