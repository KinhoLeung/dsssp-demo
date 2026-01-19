import { type GraphThemeOverride } from 'dsssp'
import tailwindColors from 'tailwindcss/colors'

import filterColors from './colors'

export const getTheme = (override?: GraphThemeOverride): GraphThemeOverride => {
  const base: GraphThemeOverride = {
    background: {
      grid: {
        lineColor: tailwindColors.zinc[700],
        lineWidth: { center: 1.5, border: 1.5, major: 1, minor: 0.5 }
      },
      gradient: { start: tailwindColors.zinc[900], stop: tailwindColors.zinc[900] },
      label: { color: tailwindColors.zinc[500], fontSize: 14 },
      tracker: {
        labelColor: tailwindColors.white,
        lineColor: tailwindColors.zinc[400]
      }
    },
    filters: {
      gradientOpacity: 0.75,
      zeroPoint: {
        color: tailwindColors.slate[400],
        background: tailwindColors.slate[500]
      },
      point: {
        label: { color: tailwindColors.white },
        backgroundOpacity: { drag: 1 }
      },
      curve: { width: { active: 1 }, opacity: { normal: 0, active: 1 } },
      colors: filterColors
    }
  }

  // Deep merge for labels if needed, or just handle top level
  if (override?.background?.label) {
    base.background = {
      ...base.background,
      label: {
        ...base.background!.label,
        ...override.background.label
      }
    }
  }

  return base
}

const theme = getTheme()

export default theme
