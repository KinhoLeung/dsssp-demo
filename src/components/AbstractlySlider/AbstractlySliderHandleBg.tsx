import React from 'react'

export type AbstractlySliderHandleBgProps = React.SVGProps<SVGSVGElement> & {
  idPrefix?: string
  title?: string
}

export function AbstractlySliderHandleBg({
  idPrefix,
  title,
  ...props
}: AbstractlySliderHandleBgProps) {
  const autoIdPrefix = React.useMemo(
    () => `ab-slider-handle-${Math.random().toString(36).slice(2, 9)}`,
    []
  )
  const prefix = idPrefix ?? autoIdPrefix
  const titleId = title ? `${prefix}-title` : undefined

  const gradientA = `${prefix}-a`
  const gradientB = `${prefix}-b`
  const gradientC = `${prefix}-c`
  const gradientD = `${prefix}-d`
  const gradientE = `${prefix}-e`
  const gradientF = `${prefix}-f`
  const gradientG = `${prefix}-g`
  const gradientH = `${prefix}-h`
  const gradientI = `${prefix}-i`

  return (
    <svg
      width={25}
      height={54}
      viewBox="0 0 25 54"
      aria-hidden={title ? undefined : true}
      aria-labelledby={titleId}
      {...props}
    >
      {title ? <title id={titleId}>{title}</title> : null}
      <defs>
        <linearGradient id={gradientA} x1="50%" x2="50%" y1="0%" y2="99.182%">
          <stop offset="0%" stopColor="#1E1E1E" />
          <stop offset="100%" stopColor="#0B0B0B" />
        </linearGradient>
        <linearGradient id={gradientB} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#1C1C1C" />
          <stop offset="100%" stopColor="#1E1E1E" />
        </linearGradient>
        <linearGradient id={gradientC} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#191919" />
          <stop offset="61.836%" stopColor="#282828" />
          <stop offset="77.209%" stopColor="#1C1C1C" />
          <stop offset="100%" stopColor="#1C1C1C" />
        </linearGradient>
        <linearGradient id={gradientD} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#2E2E2E" />
          <stop offset="100%" stopColor="#646464" />
        </linearGradient>
        <linearGradient id={gradientE} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#121212" />
          <stop offset="100%" stopColor="#222" />
        </linearGradient>
        <linearGradient
          id={gradientF}
          x1="50%"
          x2="50%"
          y1="31.152%"
          y2="70.215%"
        >
          <stop offset="0%" stopColor="#C1C1C1" />
          <stop offset="100%" stopColor="#898989" />
        </linearGradient>
        <linearGradient id={gradientG} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#111" />
          <stop offset="93.688%" stopColor="#2A2A2A" />
          <stop offset="93.765%" stopColor="#292929" />
          <stop offset="100%" stopColor="#151515" />
        </linearGradient>
        <linearGradient id={gradientH} x1="50%" x2="50%" y1="0%" y2="100%">
          <stop offset="0%" stopColor="#111" />
          <stop offset="93.688%" stopColor="#2A2A2A" />
          <stop offset="93.765%" stopColor="#292929" />
          <stop offset="100%" stopColor="#151515" />
        </linearGradient>
        <linearGradient id={gradientI} x1="50%" x2="50%" y1="0%" y2="99.736%">
          <stop offset="0%" stopColor="#3D3D3D" />
          <stop offset="100%" stopColor="#4E4E4E" />
        </linearGradient>
      </defs>
      <g fill="none" fillRule="evenodd">
        <polygon fill={`url(#${gradientA})`} points="1 48 24 48 24 53 1 53" />
        <polygon fill={`url(#${gradientB})`} points="2 5 23 5 23 8 2 8" />
        <path
          stroke={`url(#${gradientC})`}
          strokeLinecap="square"
          d="M.5.5L.5 4.5M24.5.5L24.5 4.5"
        />
        <polygon fill={`url(#${gradientD})`} points="2 8 23 8 23 47 2 47" />
        <path
          stroke={`url(#${gradientE})`}
          strokeLinecap="square"
          d="M24.5 5.5L24.5 47.5M.5 5.5L.5 47.5"
        />
        <path
          fill={`url(#${gradientF})`}
          stroke="#1B1B1B"
          strokeWidth={2}
          d="M2,24 L2,29 L23,29 L23,24 L2,24 Z"
        />
        <path
          stroke="#1E1E1E"
          strokeLinecap="square"
          d="M2.525,9.5 L22.475,9.5"
        />
        <path
          stroke="#262626"
          strokeLinecap="square"
          d="M2.525,31.5 L22.475,31.5"
        />
        <path
          stroke="#222"
          strokeLinecap="square"
          d="M2.525,11.5 L22.475,11.5"
        />
        <path
          stroke="#262626"
          strokeLinecap="square"
          d="M2.525 33.5L22.475 33.5M2.525 13.5L22.475 13.5"
        />
        <path
          stroke="#2C2C2C"
          strokeLinecap="square"
          d="M2.525,35.5 L22.475,35.5"
        />
        <path
          stroke="#292929"
          strokeLinecap="square"
          d="M2.525,15.5 L22.475,15.5"
        />
        <path
          stroke="#323232"
          strokeLinecap="square"
          d="M2.525,37.5 L22.475,37.5"
        />
        <path
          stroke={`url(#${gradientG})`}
          strokeLinecap="square"
          d="M1.5,5.5 L1.5,22.5"
        />
        <path
          stroke={`url(#${gradientH})`}
          strokeLinecap="square"
          d="M1.5,48 L1.5,31 L1.5,48 Z"
        />
        <path
          stroke={`url(#${gradientG})`}
          strokeLinecap="square"
          d="M23.5,5.5 L23.5,22.5"
        />
        <path
          stroke={`url(#${gradientH})`}
          strokeLinecap="square"
          d="M23.5,48 L23.5,31 L23.5,48 Z"
        />
        <polygon fill={`url(#${gradientI})`} points="1 0 24 0 24 4 1 4" />
        <path
          stroke="#6A6A6A"
          strokeLinecap="square"
          d="M1.52272727,4.5 L23.4772727,4.5"
        />
        <path
          stroke="#2D2D2D"
          strokeLinecap="square"
          d="M2.525,17.5 L22.475,17.5"
        />
        <path
          stroke="#393939"
          strokeLinecap="square"
          d="M2.525,39.5 L22.475,39.5"
        />
        <path
          stroke="#313131"
          strokeLinecap="square"
          d="M2.525,19.5 L22.475,19.5"
        />
        <path
          stroke="#3E3E3E"
          strokeLinecap="square"
          d="M2.525,41.5 L22.475,41.5"
        />
        <path
          stroke="#343434"
          strokeLinecap="square"
          d="M2.525,21.5 L22.475,21.5"
        />
        <path
          stroke="#444"
          strokeLinecap="square"
          d="M2.525,43.5 L22.475,43.5"
        />
        <path
          stroke="#4B4B4B"
          strokeLinecap="square"
          d="M2.525,45.5 L22.475,45.5"
        />
        <path
          stroke="#4D4D4D"
          strokeLinecap="square"
          d="M2.525,46.5 L22.475,46.5"
        />
        <path
          stroke="#2B2A2B"
          strokeLinecap="square"
          d="M2.525,22.5 L22.475,22.5"
        />
        <path
          stroke="#181818"
          strokeLinecap="square"
          d="M.5 53L.5 48.5M24.5 53L24.5 48.5"
        />
        <path
          stroke="#646464"
          strokeLinecap="square"
          d="M2.525,47.5 L22.475,47.5"
        />
      </g>
    </svg>
  )
}

