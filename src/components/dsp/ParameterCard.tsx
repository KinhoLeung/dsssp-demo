import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { uiTextKey } from './dspUtils'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export type ParameterCardProps = {
  title?: string
  className?: string
  contentClassName?: string
  children: ReactNode
}

export function ParameterCard({ title, className, contentClassName, children }: ParameterCardProps) {
  const { t } = useTranslation()
  const hasTitle = !!title
  const contentClasses = [
    'grid gap-3 grid-cols-1',
    contentClassName,
    hasTitle ? '' : 'pt-6',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <Card className={className}>
      {hasTitle ? (
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {t(`uiText.${uiTextKey(title!)}`, { defaultValue: title })}
          </CardTitle>
        </CardHeader>
      ) : null}
      <CardContent className={contentClasses}>{children}</CardContent>
    </Card>
  )
}
