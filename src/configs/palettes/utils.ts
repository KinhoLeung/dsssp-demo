import { type GraphThemeFilterColors } from 'dsssp'
import tailwindColors from 'tailwindcss/colors'

export type TailwindColorKey = keyof typeof tailwindColors

export const generateTailwindPalette = (
  colorKeys: TailwindColorKey[]
): GraphThemeFilterColors[] =>
  colorKeys.map((key) => {
    const currentColor = tailwindColors[key]
    return {
      point: currentColor[400],
      active: currentColor[300],

      curve: currentColor[500],

      gradient: currentColor[600],
      background: currentColor[600]
    }
  })

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))

const hslToHex = (h: number, s: number, l: number) => {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const light = clamp(l, 0, 100) / 100

  const c = (1 - Math.abs(2 * light - 1)) * sat
  const hh = hue / 60
  const x = c * (1 - Math.abs((hh % 2) - 1))

  let r = 0
  let g = 0
  let b = 0

  if (hh >= 0 && hh < 1) {
    r = c
    g = x
  } else if (hh >= 1 && hh < 2) {
    r = x
    g = c
  } else if (hh >= 2 && hh < 3) {
    g = c
    b = x
  } else if (hh >= 3 && hh < 4) {
    g = x
    b = c
  } else if (hh >= 4 && hh < 5) {
    r = x
    b = c
  } else {
    r = c
    b = x
  }

  const m = light - c / 2
  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

export const generateHslPalette = (
  count: number,
  {
    hueOffset = 0,
    saturation = 78,
    lightness = 45,
  }: { hueOffset?: number; saturation?: number; lightness?: number } = {},
): GraphThemeFilterColors[] => {
  const safeCount = Math.max(0, Math.floor(count))
  const goldenAngle = 137.508

  return Array.from({ length: safeCount }, (_, index) => {
    const hue = hueOffset + index * goldenAngle

    return {
      curve: hslToHex(hue, saturation, lightness),
      point: hslToHex(hue, saturation - 8, lightness + 12),
      active: hslToHex(hue, saturation - 10, lightness + 18),
      gradient: hslToHex(hue, saturation, lightness - 14),
      background: hslToHex(hue, saturation, lightness - 14),
    }
  })
}
