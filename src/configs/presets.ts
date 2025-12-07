import { type GraphFilter } from 'dsssp'

export const customPreset: GraphFilter[] = [
  { freq: 20, gain: 0.0, q: 0.7, type: 'HIGHPASS2' },
  { freq: 56, gain: +4.0, q: 0.7, type: 'PEAK' },
  { freq: 135, gain: -6.0, q: 0.7, type: 'PEAK' },
  { freq: 397, gain: +7.0, q: 0.7, type: 'PEAK' },
  { freq: 1000, gain: -8.0, q: 0.7, type: 'PEAK' },
  { freq: 2520, gain: +7.0, q: 0.7, type: 'PEAK' },
  { freq: 6350, gain: -6.0, q: 0.7, type: 'PEAK' },
  { freq: 16000, gain: +4.0, q: 0.7, type: 'PEAK' },
  { freq: 20000, gain: 0.0, q: 0.7, type: 'LOWPASS2' }
]

export const brightPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 60, gain: -1.0, q: 1.0, type: 'LOWSHELF2' },
  { freq: 400, gain: 0.0, q: 0.7, type: 'BYPASS' },
  { freq: 1000, gain: +4.0, q: 1.2, type: 'PEAK' },
  { freq: 2500, gain: +5.0, q: 1.2, type: 'PEAK' },
  { freq: 6400, gain: +6.0, q: 1.2, type: 'PEAK' },
  { freq: 12000, gain: +10.0, q: 0.8, type: 'HIGHSHELF2' },
  { freq: 16000, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'BYPASS' }
]

export const excitedPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 60, gain: +8.0, q: 1.0, type: 'LOWSHELF2' },
  { freq: 400, gain: -1.0, q: 0.7, type: 'PEAK' },
  { freq: 1000, gain: +1.0, q: 0.7, type: 'PEAK' },
  { freq: 2500, gain: 0.0, q: 0.7, type: 'BYPASS' },
  { freq: 6400, gain: +2.5, q: 0.7, type: 'PEAK' },
  { freq: 12000, gain: +6.0, q: 0.7, type: 'HIGHSHELF2' },
  { freq: 16000, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'BYPASS' }
]

export const mellowPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 60, gain: -3.0, q: 1.0, type: 'LOWSHELF2' },
  { freq: 400, gain: -1.0, q: 0.7, type: 'PEAK' },
  { freq: 1000, gain: -2.0, q: 0.5, type: 'PEAK' },
  { freq: 2500, gain: 0.0, q: 0.7, type: 'BYPASS' },
  { freq: 6400, gain: -4.0, q: 0.5, type: 'PEAK' },
  { freq: 16000, gain: -6.0, q: 0.5, type: 'PEAK' },
  { freq: 16000, gain: 0.0, q: 0.7, type: 'LOWPASS2' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'BYPASS' }
]

export const speechPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 60, gain: 0.0, q: 0.6, type: 'HIGHPASS2' },
  { freq: 400, gain: +4.0, q: 0.7, type: 'PEAK' },
  { freq: 1000, gain: +3.0, q: 0.7, type: 'PEAK' },
  { freq: 2500, gain: +1.0, q: 0.7, type: 'PEAK' },
  { freq: 6400, gain: +2.0, q: 0.7, type: 'PEAK' },
  { freq: 16000, gain: -10.0, q: 0.7, type: 'PEAK' },
  { freq: 16000, gain: 0.0, q: 0.7, type: 'LOWPASS2' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'BYPASS' }
]

export const vocalPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'BYPASS' },
  { freq: 60, gain: 0.0, q: 0.6, type: 'BYPASS' },
  { freq: 400, gain: +6.0, q: 0.7, type: 'PEAK' },
  { freq: 1000, gain: +4.0, q: 0.7, type: 'PEAK' },
  { freq: 2500, gain: +2.0, q: 0.7, type: 'PEAK' },
  { freq: 6400, gain: +3.0, q: 0.7, type: 'PEAK' },
  { freq: 16000, gain: -1.0, q: 0.7, type: 'LOWPASS2' },
  { freq: 16000, gain: 0.0, q: 0.7, type: 'BYPASS' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'BYPASS' }
]

export const flatPreset: GraphFilter[] = [
  { freq: 50, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 100, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 200, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 400, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 800, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 1600, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 3200, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 6400, gain: 0.0, q: 1.0, type: 'PEAK' },
  { freq: 12800, gain: 0.0, q: 1.0, type: 'PEAK' }
]

const presets = [
  { name: 'Custom', filters: customPreset },
  { name: 'Bright', filters: brightPreset },
  { name: 'Excited', filters: excitedPreset },
  { name: 'Vocal', filters: vocalPreset },
  { name: 'Mellow', filters: mellowPreset },
  { name: 'Speech', filters: speechPreset },
  { name: 'Flat', filters: flatPreset }
]

export default presets
