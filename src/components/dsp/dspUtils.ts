import type { FilterType, GraphFilter } from 'dsssp'

import { webhmi } from '@/device/proto/generated/webhmi'

export type PanelKey =
  | 'music'
  | 'mica'
  | 'micb'
  | 'reverb'
  | 'echo'
  | 'mainoutput'
  | 'suboutput'
  | 'center'
  | 'surround'

export type MainTabKey = 'music' | 'mic' | 'reverb' | 'echo' | 'mainoutput' | 'suboutput' | 'center' | 'surround' | 'system'

export const uiTextKey = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

export type PanelDef = {
  key: PanelKey
  label: string
  target: webhmi.EqTarget
  getEq: (db: webhmi.IDeviceConfig | null) => webhmi.IEq | null
}

export type EqGraphFilter = GraphFilter & {
  commonQ: number
  peakQ: number
}

export type PanelState = {
  filters: EqGraphFilter[]
  pointIndexByUiIndex: number[]
  allowedTypesByUiIndex: Array<FilterType[] | null>
}

export type SelectOption = {
  value: string
  label: string
}

export const hasNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
export const hasBoolean = (value: unknown): value is boolean => typeof value === 'boolean'
export const hasAny = (...values: unknown[]) => values.some((value) => hasNumber(value) || hasBoolean(value))
export const hasEnum = (value: unknown, enumObj?: any): boolean => {
  if (value === undefined || value === null || value === '') return false
  if (!enumObj) return true
  if (typeof value === 'number') {
    return enumObj[value] !== undefined
  }
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return enumObj[parsed] !== undefined
    }
    return enumObj[value] !== undefined
  }
  return false
}
export const getEnumNumberValue = (value: unknown, enumObj: any): number => {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) return parsed
    const mapped = enumObj[value]
    if (typeof mapped === 'number') return mapped
  }
  return NaN
}

export const INPUT_SELECT_OPTIONS: SelectOption[] = [
  { value: String(webhmi.InputSelect.BT), label: 'BT' },
  { value: String(webhmi.InputSelect.UDISK), label: 'UDISK' },
  { value: String(webhmi.InputSelect.SPDIF), label: 'SPDIF' },
  { value: String(webhmi.InputSelect.COA), label: 'COA' },
  { value: String(webhmi.InputSelect.USB), label: 'USB' },
  { value: String(webhmi.InputSelect.AUX1), label: 'AUX1' },
  { value: String(webhmi.InputSelect.AUX2), label: 'AUX2' },
]

export const FBX_OPTIONS: SelectOption[] = [
  { value: String(webhmi.FbxMode.Off), label: 'Off' },
  { value: String(webhmi.FbxMode.Level1), label: 'Level 1' },
  { value: String(webhmi.FbxMode.Level2), label: 'Level 2' },
  { value: String(webhmi.FbxMode.Level3), label: 'Level 3' },
  { value: String(webhmi.FbxMode.Level4), label: 'Level 4' },
  { value: String(webhmi.FbxMode.Level5), label: 'Level 5' },
  { value: String(webhmi.FbxMode.Level6), label: 'Level 6' },
]

export const nearlyEqual = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps
export const isPeakFilterType = (type: string | null | undefined) => type === 'PEAK'
export const isFixedQFilterType = (type: string | null | undefined) =>
  typeof type === 'string' && (type.includes('HIGHPASS') || type.includes('LOWPASS'))

export const panelStateEqual = (a: PanelState, b: PanelState) => {
  if (a.pointIndexByUiIndex.length !== b.pointIndexByUiIndex.length) return false
  for (let i = 0; i < a.pointIndexByUiIndex.length; i++) {
    if (a.pointIndexByUiIndex[i] !== b.pointIndexByUiIndex[i]) return false
  }

  if (a.filters.length !== b.filters.length) return false
  for (let i = 0; i < a.filters.length; i++) {
    const fa = a.filters[i]
    const fb = b.filters[i]
    if (fa.type !== fb.type) return false
    if (!nearlyEqual(fa.freq, fb.freq)) return false
    if (!nearlyEqual(fa.gain, fb.gain)) return false
    if (!nearlyEqual(fa.q, fb.q)) return false
    if (!nearlyEqual(fa.commonQ, fb.commonQ)) return false
    if (!nearlyEqual(fa.peakQ, fb.peakQ)) return false
  }

  if (a.allowedTypesByUiIndex.length !== b.allowedTypesByUiIndex.length) return false
  for (let i = 0; i < a.allowedTypesByUiIndex.length; i++) {
    const aa = a.allowedTypesByUiIndex[i]
    const bb = b.allowedTypesByUiIndex[i]
    if (aa == null && bb == null) continue
    if (aa == null || bb == null) return false
    if (aa.length !== bb.length) return false
    for (let j = 0; j < aa.length; j++) {
      if (aa[j] !== bb[j]) return false
    }
  }

  return true
}

export function mapFilterTypeToGraphType(type: webhmi.FilterType | null | undefined): GraphFilter['type'] {
  switch (type) {
    case webhmi.FilterType.Peak:
      return 'PEAK'
    case webhmi.FilterType.LowShelf:
      return 'LOWSHELF2'
    case webhmi.FilterType.HighShelf:
      return 'HIGHSHELF2'
    case webhmi.FilterType.LowPass:
      return 'LOWPASS2'
    case webhmi.FilterType.HighPass:
      return 'HIGHPASS2'
    case webhmi.FilterType.BandPass:
      return 'BANDPASS'
    case webhmi.FilterType.Notch:
      return 'NOTCH'
    default:
      return 'PEAK'
  }
}

export function mapGraphTypeToFilterType(type: GraphFilter['type']): webhmi.FilterType {
  switch (type) {
    case 'PEAK':
      return webhmi.FilterType.Peak
    case 'LOWSHELF1':
    case 'LOWSHELF2':
      return webhmi.FilterType.LowShelf
    case 'HIGHSHELF1':
    case 'HIGHSHELF2':
      return webhmi.FilterType.HighShelf
    case 'LOWPASS1':
    case 'LOWPASS2':
      return webhmi.FilterType.LowPass
    case 'HIGHPASS1':
    case 'HIGHPASS2':
      return webhmi.FilterType.HighPass
    case 'BANDPASS':
      return webhmi.FilterType.BandPass
    case 'NOTCH':
      return webhmi.FilterType.Notch
    case 'BYPASS':
      return webhmi.FilterType.Peak
    default:
      return webhmi.FilterType.Peak
  }
}

export function buildPanelStateFromEq(eq: webhmi.IEq | null): PanelState {
  const points = eq?.point ?? []
  const sorted = [...points].sort((a, b) => (Number(a.index ?? 0) || 0) - (Number(b.index ?? 0) || 0))

  const filters: EqGraphFilter[] = []
  const pointIndexByUiIndex: number[] = []
  const allowedTypesByUiIndex: Array<FilterType[] | null> = []

  const toUniqueGraphTypes = (types: Array<webhmi.FilterType | null | undefined> | null | undefined) => {
    const out: FilterType[] = []
    for (const t of types ?? []) {
      const mapped = mapFilterTypeToGraphType(t)
      if (!out.includes(mapped)) out.push(mapped)
    }
    return out
  }

  const allCount = sorted.length
  const highPassList = toUniqueGraphTypes(eq?.highPassTypeList)
  const midList = toUniqueGraphTypes(eq?.typeList)
  const lowPassList = toUniqueGraphTypes(eq?.lowPassTypeList)
  const graphTypeByUiIndex = sorted.map((p) => mapFilterTypeToGraphType(p.type))
  const highPassSlot = graphTypeByUiIndex.findIndex((t) => t.includes('HIGHPASS'))
  const lowPassSlot = graphTypeByUiIndex.findIndex((t) => t.includes('LOWPASS'))
  const highPassSlotIndex = highPassSlot >= 0 ? highPassSlot : 0
  const lowPassSlotIndex = lowPassSlot >= 0 ? lowPassSlot : Math.max(0, allCount - 1)

  for (let uiIndex = 0; uiIndex < sorted.length; uiIndex++) {
    const p = sorted[uiIndex] ?? {}
    const pointIndex = typeof p.index === 'number' ? p.index : uiIndex
    pointIndexByUiIndex.push(pointIndex)

    const graphType = graphTypeByUiIndex[uiIndex] ?? mapFilterTypeToGraphType(p.type)
    const commonQ = typeof p.q === 'number' ? p.q : 0.7
    const peakQ = typeof p.peakQ === 'number' ? p.peakQ : 1
    filters.push({
      type: graphType,
      freq: typeof p.freq === 'number' ? p.freq : 1000,
      gain: typeof p.gain === 'number' ? p.gain : 0,
      q: isPeakFilterType(graphType) ? peakQ : commonQ,
      commonQ,
      peakQ,
    })

    let allowed: FilterType[] | null = null
    if (allCount <= 1) {
      allowed = [...highPassList, ...midList, ...lowPassList]
    } else if (uiIndex === highPassSlotIndex) {
      allowed = highPassList.length ? highPassList : midList
    } else if (uiIndex === lowPassSlotIndex) {
      allowed = lowPassList.length ? lowPassList : midList
    } else {
      allowed = midList.length ? midList : [...highPassList, ...lowPassList]
    }

    if (allowed.length === 0) {
      allowedTypesByUiIndex.push(null)
    } else {
      allowedTypesByUiIndex.push(allowed.includes(graphType) ? allowed : [graphType, ...allowed])
    }
  }

  return { filters, pointIndexByUiIndex, allowedTypesByUiIndex }
}
