import { type GraphThemeOverride } from 'dsssp'
import tailwindColors from 'tailwindcss/colors'

import filterColors from './colors'

export const graphThemeDark: GraphThemeOverride = {
  background: {
    grid: {
      lineColor: tailwindColors.zinc[800],
      lineWidth: { center: 1, border: 1 }
    },
    gradient: {
      start: tailwindColors.zinc[900],
      stop: tailwindColors.zinc[950]
    },
    label: { color: tailwindColors.zinc[500] },
    tracker: {
      labelColor: tailwindColors.white,
      lineColor: tailwindColors.zinc[400],
      backgroundColor: tailwindColors.zinc[900]
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
    curve: { width: { active: 1 }, opacity: { normal: 0.75, active: 1 } },
    colors: filterColors
  }
}

export const graphThemeLight: GraphThemeOverride = {
  background: {
    grid: {
      lineColor: tailwindColors.zinc[200],
      lineWidth: { center: 1, border: 1 }
    },
    gradient: {
      start: tailwindColors.white,
      stop: tailwindColors.zinc[50]
    },
    label: { color: tailwindColors.zinc[600] },
    tracker: {
      labelColor: tailwindColors.zinc[700],
      lineColor: tailwindColors.zinc[300],
      backgroundColor: tailwindColors.white
    }
  },
  filters: {
    gradientOpacity: 0.6,
    zeroPoint: {
      color: tailwindColors.slate[500],
      background: tailwindColors.slate[300]
    },
    point: {
      label: { color: tailwindColors.zinc[900] },
      backgroundOpacity: { drag: 0.9 }
    },
    curve: { width: { active: 1 }, opacity: { normal: 0.75, active: 1 } },
    colors: filterColors
  }
}

export default graphThemeDark
