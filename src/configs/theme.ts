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

  if (override) {
    const deepMerge = (target: any, source: any) => {
      for (const key in source) {
        if (source[key] === undefined) continue
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          if (!target[key] || typeof target[key] !== 'object') target[key] = {}
          deepMerge(target[key], source[key])
        } else {
          target[key] = source[key]
        }
      }
    }
    deepMerge(base, override)
  }

  return base
}

const theme = getTheme()

export default theme
