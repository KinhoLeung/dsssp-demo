import { generateHslPalette } from './palettes/utils'

const FILTER_COLORS_COUNT = 256

export default generateHslPalette(FILTER_COLORS_COUNT, { hueOffset: 15 })
