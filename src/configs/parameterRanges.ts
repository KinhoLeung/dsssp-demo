export type RangeConfig = {
  min: number
  max: number
  step: number
}

export type EqRangeConfig = {
  freq: RangeConfig
  gain: RangeConfig
  q: RangeConfig
}

const range = (min: number, max: number, step: number): RangeConfig => ({
  min,
  max,
  step
})

const eqRange: EqRangeConfig = {
  freq: range(20, 20000, 1),
  gain: range(-18, 12, 0.1),
  q: range(0.1, 25, 0.1)
}

const levelRange = range(0, 100, 1)
const toneRange = range(-12, 12, 0.1)
const compressorRange = {
  threshold: range(-60, 0, 0.1),
  ratio: range(2, 100, 1),
  attack: range(0, 500, 1),
  release: range(50, 3000, 1)
}

const parameterRanges = {
  system: {
    musicMaxVolume: range(0, 80, 1),
    micMaxVolume: range(0, 80, 1),
    effectMaxVolume: range(0, 80, 1),
    musicDefaultVolume: range(0, 80, 1),
    micDefaultVolume: range(0, 80, 1),
    effectDefaultVolume: range(0, 80, 1),
    musicVolume: range(0, 80, 1),
    micVolume: range(0, 80, 1),
    effectVolume: range(0, 80, 1),
    micDetectionThreshold: range(-60, 0, 1),
    micDetectionTime: range(1, 30, 1)
  },
  music: {
    eq: eqRange,
    inputGain: range(-10, 0, 1),
    btGain: range(-10, 0, 1),
    udiskGain: range(-10, 0, 1),
    musicPitch: range(-12.5, 12.5, 0.1),
    bass: toneRange,
    mid: toneRange,
    midFreq: range(20, 20000, 1),
    treble: toneRange,
    noise: {
      gate: range(-90, -50, 0.1),
      frameTime: range(1, 5000, 1),
      atkTime: range(1, 3000, 1),
      relTime: range(1, 3000, 1)
    }
  },
  mic: {
    micAEq: { eq: eqRange },
    micBEq: { eq: eqRange },
    micAVolume: levelRange,
    micBVolume: levelRange,
    bass: toneRange,
    mid: toneRange,
    midFreq: range(20, 20000, 1),
    treble: toneRange,
    noise: {
      gate: range(-90, -50, 0.1),
      frameTime: range(1, 5000, 1),
      atkTime: range(1, 3000, 1),
      relTime: range(1, 3000, 1)
    },
    compressor: compressorRange
  },
  reverb: {
    eq: eqRange,
    reverbLevel: levelRange,
    micDirectLevel: levelRange,
    reverbPredelay: range(0, 200, 1),
    reverbDecay: range(0, 5000, 1)
  },
  echo: {
    eq: eqRange,
    echoLevel: levelRange,
    micDirectLevel: levelRange,
    echoPredelay: range(0, 250, 1),
    echoDelayTime: range(0, 500, 1),
    echoRepeat: range(0, 90, 1),
    echoRightPredelay: range(0, 50, 1),
    echoRightDelay: range(-50, 50, 1)
  },
  mainOutput: {
    eq: eqRange,
    output: {
      leftChannelVolume: range(-70, 12, 0.1),
      rightChannelVolume: range(-70, 12, 0.1),
      leftDelay: range(0, 50, 0.1),
      rightDelay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  subOutput: {
    eq: eqRange,
    output: {
      volume: range(-70, 24, 0.1),
      delay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  center: {
    eq: eqRange,
    output: {
      volume: range(-70, 12, 0.1),
      delay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  },
  surround: {
    eq: eqRange,
    output: {
      leftChannelVolume: range(-70, 12, 0.1),
      rightChannelVolume: range(-70, 12, 0.1),
      leftDelay: range(0, 50, 0.1),
      rightDelay: range(0, 50, 0.1)
    },
    mixer: {
      micDirectLevel: levelRange,
      musicLevel: levelRange,
      reverbLevel: levelRange,
      echoLevel: levelRange
    },
    compressor: compressorRange
  }
}

type RangeField = 'min' | 'max' | 'step'
type RangeKey = `${RangeField}${string}`
type RangeSource = Partial<Record<RangeKey, number>> | null | undefined

const hasFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

const getNumber = (source: RangeSource, key: RangeKey, fallback: number) => {
  const value = source?.[key]
  return hasFiniteNumber(value) ? value : fallback
}

const fromDbRange = (source: RangeSource, fieldName: string, fallback: RangeConfig): RangeConfig => {
  const min = getNumber(source, `min${fieldName}`, fallback.min)
  const max = getNumber(source, `max${fieldName}`, fallback.max)
  const step = getNumber(source, `step${fieldName}`, fallback.step)

  return {
    min: min <= max ? min : fallback.min,
    max: min <= max ? max : fallback.max,
    step: step > 0 ? step : fallback.step
  }
}

const eqRangesFromDb = (source: RangeSource, fallback: EqRangeConfig): EqRangeConfig => ({
  freq: fromDbRange(source, 'Freq', fallback.freq),
  gain: fromDbRange(source, 'Gain', fallback.gain),
  q: fromDbRange(source, 'Q', fallback.q)
})

const noiseRangesFromDb = (source: RangeSource, fallback: typeof parameterRanges.music.noise) => ({
  gate: fromDbRange(source, 'Gate', fallback.gate),
  frameTime: fromDbRange(source, 'FrameTime', fallback.frameTime),
  atkTime: fromDbRange(source, 'AtkTime', fallback.atkTime),
  relTime: fromDbRange(source, 'RelTime', fallback.relTime)
})

const compressorRangesFromDb = (source: RangeSource, fallback: typeof parameterRanges.mic.compressor) => ({
  threshold: fromDbRange(source, 'Threshold', fallback.threshold),
  ratio: fromDbRange(source, 'Ratio', fallback.ratio),
  attack: fromDbRange(source, 'Attack', fallback.attack),
  release: fromDbRange(source, 'Release', fallback.release)
})

const mixerRangesFromDb = (source: RangeSource, fallback: typeof parameterRanges.mainOutput.mixer) => ({
  micDirectLevel: fromDbRange(source, 'MicDirectLevel', fallback.micDirectLevel),
  musicLevel: fromDbRange(source, 'MusicLevel', fallback.musicLevel),
  reverbLevel: fromDbRange(source, 'ReverbLevel', fallback.reverbLevel),
  echoLevel: fromDbRange(source, 'EchoLevel', fallback.echoLevel)
})

const stereoOutputRangesFromDb = (source: RangeSource, fallback: typeof parameterRanges.mainOutput.output) => ({
  leftChannelVolume: fromDbRange(source, 'LeftChannelVolume', fallback.leftChannelVolume),
  rightChannelVolume: fromDbRange(source, 'RightChannelVolume', fallback.rightChannelVolume),
  leftDelay: fromDbRange(source, 'LeftDelay', fallback.leftDelay),
  rightDelay: fromDbRange(source, 'RightDelay', fallback.rightDelay)
})

const monoOutputRangesFromDb = (source: RangeSource, fallback: typeof parameterRanges.subOutput.output) => ({
  volume: fromDbRange(source, 'Volume', fallback.volume),
  delay: fromDbRange(source, 'Delay', fallback.delay)
})

export const withRangeBounds = (base: RangeConfig, bounds: { min?: number | null; max?: number | null }): RangeConfig => {
  const min = hasFiniteNumber(bounds.min) ? Math.max(base.min, bounds.min) : base.min
  const max = hasFiniteNumber(bounds.max) ? Math.min(base.max, bounds.max) : base.max

  return min <= max ? { ...base, min, max } : base
}

export const clampToRange = (value: number, rangeConfig: RangeConfig) =>
  Math.min(Math.max(value, rangeConfig.min), rangeConfig.max)

export const buildParameterRanges = (db: any = {}) => {
  const safeDb = db || {}
  return {
    system: {
      musicMaxVolume: fromDbRange(safeDb.system, 'MusicMaxVolume', parameterRanges.system.musicMaxVolume),
      micMaxVolume: fromDbRange(safeDb.system, 'MicMaxVolume', parameterRanges.system.micMaxVolume),
      effectMaxVolume: fromDbRange(safeDb.system, 'EffectMaxVolume', parameterRanges.system.effectMaxVolume),
      musicDefaultVolume: fromDbRange(safeDb.system, 'MusicDefaultVolume', parameterRanges.system.musicDefaultVolume),
      micDefaultVolume: fromDbRange(safeDb.system, 'MicDefaultVolume', parameterRanges.system.micDefaultVolume),
      effectDefaultVolume: fromDbRange(safeDb.system, 'EffectDefaultVolume', parameterRanges.system.effectDefaultVolume),
      musicVolume: fromDbRange(safeDb.system, 'MusicVolume', parameterRanges.system.musicVolume),
      micVolume: fromDbRange(safeDb.system, 'MicVolume', parameterRanges.system.micVolume),
      effectVolume: fromDbRange(safeDb.system, 'EffectVolume', parameterRanges.system.effectVolume),
      micDetectionThreshold: fromDbRange(safeDb.system, 'MicDetectionThreshold', parameterRanges.system.micDetectionThreshold),
      micDetectionTime: fromDbRange(safeDb.system, 'MicDetectionTime', parameterRanges.system.micDetectionTime)
    },
    music: {
      eq: eqRangesFromDb(safeDb.music?.eq, parameterRanges.music.eq),
      inputGain: fromDbRange(safeDb.music, 'InputGain', parameterRanges.music.inputGain),
      btGain: fromDbRange(safeDb.music, 'BtGain', parameterRanges.music.btGain),
      udiskGain: fromDbRange(safeDb.music, 'UdiskGain', parameterRanges.music.udiskGain),
      musicPitch: fromDbRange(safeDb.music, 'MusicPitch', parameterRanges.music.musicPitch),
      bass: fromDbRange(safeDb.music, 'Bass', parameterRanges.music.bass),
      mid: fromDbRange(safeDb.music, 'Mid', parameterRanges.music.mid),
      midFreq: fromDbRange(safeDb.music, 'MidFreq', parameterRanges.music.midFreq),
      treble: fromDbRange(safeDb.music, 'Treble', parameterRanges.music.treble),
      noise: noiseRangesFromDb(safeDb.music?.noise, parameterRanges.music.noise)
    },
    mic: {
      micAEq: { eq: eqRangesFromDb(safeDb.mic?.micAEq?.eq, parameterRanges.mic.micAEq.eq) },
      micBEq: { eq: eqRangesFromDb(safeDb.mic?.micBEq?.eq, parameterRanges.mic.micBEq.eq) },
      micAVolume: fromDbRange(safeDb.mic, 'MicAVolume', parameterRanges.mic.micAVolume),
      micBVolume: fromDbRange(safeDb.mic, 'MicBVolume', parameterRanges.mic.micBVolume),
      bass: fromDbRange(safeDb.mic, 'Bass', parameterRanges.mic.bass),
      mid: fromDbRange(safeDb.mic, 'Mid', parameterRanges.mic.mid),
      midFreq: fromDbRange(safeDb.mic, 'MidFreq', parameterRanges.mic.midFreq),
      treble: fromDbRange(safeDb.mic, 'Treble', parameterRanges.mic.treble),
      noise: noiseRangesFromDb(safeDb.mic?.noise, parameterRanges.mic.noise),
      compressor: compressorRangesFromDb(safeDb.mic?.compressor, parameterRanges.mic.compressor)
    },
    reverb: {
      eq: eqRangesFromDb(safeDb.reverb?.eq, parameterRanges.reverb.eq),
      reverbLevel: fromDbRange(safeDb.reverb, 'ReverbLevel', parameterRanges.reverb.reverbLevel),
      micDirectLevel: fromDbRange(safeDb.reverb, 'MicDirectLevel', parameterRanges.reverb.micDirectLevel),
      reverbPredelay: fromDbRange(safeDb.reverb, 'ReverbPredelay', parameterRanges.reverb.reverbPredelay),
      reverbDecay: fromDbRange(safeDb.reverb, 'ReverbDecay', parameterRanges.reverb.reverbDecay)
    },
    echo: {
      eq: eqRangesFromDb(safeDb.echo?.eq, parameterRanges.echo.eq),
      echoLevel: fromDbRange(safeDb.echo, 'EchoLevel', parameterRanges.echo.echoLevel),
      micDirectLevel: fromDbRange(safeDb.echo, 'MicDirectLevel', parameterRanges.echo.micDirectLevel),
      echoPredelay: fromDbRange(safeDb.echo, 'EchoPredelay', parameterRanges.echo.echoPredelay),
      echoDelayTime: fromDbRange(safeDb.echo, 'EchoDelayTime', parameterRanges.echo.echoDelayTime),
      echoRepeat: fromDbRange(safeDb.echo, 'EchoRepeat', parameterRanges.echo.echoRepeat),
      echoRightPredelay: fromDbRange(safeDb.echo, 'EchoRightPredelay', parameterRanges.echo.echoRightPredelay),
      echoRightDelay: fromDbRange(safeDb.echo, 'EchoRightDelay', parameterRanges.echo.echoRightDelay)
    },
    mainOutput: {
      eq: eqRangesFromDb(safeDb.mainOutput?.singEq ?? safeDb.mainOutput?.danceEq, parameterRanges.mainOutput.eq),
      output: stereoOutputRangesFromDb(safeDb.mainOutput?.output, parameterRanges.mainOutput.output),
      mixer: mixerRangesFromDb(safeDb.mainOutput?.singMixer ?? safeDb.mainOutput?.danceMixer, parameterRanges.mainOutput.mixer),
      compressor: compressorRangesFromDb(safeDb.mainOutput?.compressor, parameterRanges.mainOutput.compressor)
    },
    subOutput: {
      eq: eqRangesFromDb(safeDb.subOutput?.singEq ?? safeDb.subOutput?.danceEq, parameterRanges.subOutput.eq),
      output: monoOutputRangesFromDb(safeDb.subOutput?.output, parameterRanges.subOutput.output),
      mixer: mixerRangesFromDb(safeDb.subOutput?.singMixer ?? safeDb.subOutput?.danceMixer, parameterRanges.subOutput.mixer),
      compressor: compressorRangesFromDb(safeDb.subOutput?.compressor, parameterRanges.subOutput.compressor)
    },
    center: {
      eq: eqRangesFromDb(safeDb.center?.singEq ?? safeDb.center?.danceEq, parameterRanges.center.eq),
      output: monoOutputRangesFromDb(safeDb.center?.output, parameterRanges.center.output),
      mixer: mixerRangesFromDb(safeDb.center?.singMixer ?? safeDb.center?.danceMixer, parameterRanges.center.mixer),
      compressor: compressorRangesFromDb(safeDb.center?.compressor, parameterRanges.center.compressor)
    },
    surround: {
      eq: eqRangesFromDb(safeDb.surround?.singEq ?? safeDb.surround?.danceEq, parameterRanges.surround.eq),
      output: stereoOutputRangesFromDb(safeDb.surround?.output, parameterRanges.surround.output),
      mixer: mixerRangesFromDb(safeDb.surround?.singMixer ?? safeDb.surround?.danceMixer, parameterRanges.surround.mixer),
      compressor: compressorRangesFromDb(safeDb.surround?.compressor, parameterRanges.surround.compressor)
    }
  }
}

export default parameterRanges
